import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ExtractedContacts, extractContacts } from "./contact-extractor";
import { EmailVerification, verifyEmail } from "./email-verifier";
import { EnrichmentResult, mergeContacts } from "./enrichment.logic";
import { PoliteFetcher } from "./polite-fetch";
import { normalizePhone } from "../common/util/normalize";

const CONTACT_PATHS = ["", "/contato", "/contact", "/fale-conosco", "/sobre"];
const MAX_PAGES = 3;

export interface EnrichInput {
  phone: string | null;
  mapsSource: string;
  mapsEmails: string[];
  website: string | null;
  siteStatus: string;
  callingCode: string;
}

@Injectable()
export class EnrichmentService {
  private readonly logger = new Logger(EnrichmentService.name);
  private readonly fetcher = new PoliteFetcher();

  constructor(private config: ConfigService) {}

  /** Only crawl a page the business itself owns/publishes (own site or free-builder site). */
  private crawlable(siteStatus: string, website: string | null): boolean {
    return Boolean(website) && ["HAS_SITE", "FREE_BUILDER", "UNKNOWN"].includes(siteStatus);
  }

  async enrich(input: EnrichInput): Promise<EnrichmentResult & { errors: string[] }> {
    const errors: string[] = [];
    const pageContacts: Array<{ pageUrl: string; contacts: ExtractedContacts }> = [];

    if (this.crawlable(input.siteStatus, input.website)) {
      const base = new URL(/^https?:\/\//i.test(input.website!) ? input.website! : `https://${input.website}`);
      let fetched = 0;
      for (const path of CONTACT_PATHS) {
        if (fetched >= MAX_PAGES) break;
        const url = new URL(path || base.pathname, base.origin).toString();
        try {
          const page = await this.fetcher.fetchHtml(url);
          if (!page) {
            errors.push(`robots.txt disallows ${url}`);
            continue;
          }
          fetched++;
          if (page.status >= 200 && page.status < 400 && page.html) {
            pageContacts.push({ pageUrl: url, contacts: extractContacts(page.html, input.callingCode) });
          }
        } catch (err) {
          errors.push(`fetch ${url}: ${err instanceof Error ? err.message : String(err)}`);
          break; // host unreachable — don't hammer it
        }
      }
    }

    const emailCandidates = new Set<string>([...input.mapsEmails, ...pageContacts.flatMap((p) => p.contacts.emails)]);
    const smtp = this.config.get<string>("EMAIL_SMTP_VERIFY", "false") === "true";
    const emailChecks = new Map<string, EmailVerification>();
    for (const e of emailCandidates) emailChecks.set(e.toLowerCase(), await verifyEmail(e.toLowerCase(), { smtp }));

    const merged = mergeContacts({
      mapsPhoneE164: normalizePhone(input.phone, input.callingCode),
      mapsSource: input.mapsSource,
      mapsEmails: input.mapsEmails,
      pageContacts,
      emailChecks,
    });
    if (errors.length) this.logger.debug(`enrichment notes: ${errors.join(" | ")}`);
    return { ...merged, errors };
  }
}
