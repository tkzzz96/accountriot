// Contact extraction from a fetched HTML page.
// Approach adapted from omkarcloud/website-email-contact-scraper (MIT) — see THIRD_PARTY_NOTICES.md.
import { normalizePhone } from "../common/util/normalize";

export interface ExtractedContacts {
  emails: string[];
  phones: string[];
  whatsapp: string[];
  socials: Record<string, string>;
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/gi;
const JUNK_EMAIL_DOMAINS = ["example.com", "sentry.io", "wixpress.com", "domain.com", "email.com", "yoursite.com", "godaddy.com"];
const JUNK_EMAIL_EXT = /\.(png|jpe?g|gif|svg|webp|css|js)$/i;

const SOCIAL_PATTERNS: Array<[string, RegExp]> = [
  ["instagram", /https?:\/\/(?:www\.)?instagram\.com\/(?!p\/|explore|accounts|reel)[a-z0-9._]+/i],
  ["facebook", /https?:\/\/(?:www\.|m\.|pt-br\.)?facebook\.com\/(?!sharer|share|tr\?|plugins|dialog)[a-z0-9._\-/]+/i],
  ["tiktok", /https?:\/\/(?:www\.)?tiktok\.com\/@[a-z0-9._]+/i],
  ["linkedin", /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/(?:company|in)\/[a-z0-9._\-%]+/i],
  ["youtube", /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[a-z0-9._\-]+/i],
  ["x", /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/(?!intent|share|home)[a-z0-9_]+/i],
];

/** Decode simple obfuscations: "name [at] domain [dot] com", HTML entities for @ */
function deobfuscate(text: string): string {
  return text
    .replace(/&#0*64;|&commat;|&#x0*40;/gi, "@")
    .replace(/\s*[\[(]\s*(?:at|arroba)\s*[\])]\s*/gi, "@")
    .replace(/\s*[\[(]\s*(?:dot|ponto)\s*[\])]\s*/gi, ".");
}

export function extractEmails(html: string): string[] {
  const decoded = deobfuscate(html);
  const mailtos = [...decoded.matchAll(/mailto:([^"'?\s>]+)/gi)].map((m) => decodeURIComponent(m[1]));
  const found = [...mailtos, ...(decoded.match(EMAIL_RE) ?? [])]
    .map((e) => e.trim().toLowerCase().replace(/[.,;:]+$/, ""))
    .filter((e) => !JUNK_EMAIL_EXT.test(e))
    .filter((e) => !JUNK_EMAIL_DOMAINS.some((d) => e.endsWith(`@${d}`)));
  return [...new Set(found)];
}

export function extractWhatsapp(html: string, callingCode: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?[^"'\s>]*?phone=|web\.whatsapp\.com\/send\?[^"'\s>]*?phone=)(\+?\d{8,15})/gi)) {
    const n = normalizePhone(m[1].startsWith("+") ? m[1] : `+${m[1]}`, callingCode);
    if (n) out.add(n);
  }
  return [...out];
}

export function extractPhones(html: string, callingCode: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/tel:([+\d\s().-]{8,20})/gi)) {
    const n = normalizePhone(m[1], callingCode);
    if (n) out.add(n);
  }
  // Visible phone patterns: (41) 99999-8888, +55 41 99999 8888
  for (const m of html.matchAll(/(?:\+\d{1,3}\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g)) {
    const raw = m[0];
    if (raw.replace(/\D/g, "").length < 10) continue;
    const n = normalizePhone(raw, callingCode);
    if (n) out.add(n);
  }
  return [...out];
}

export function extractSocials(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, re] of SOCIAL_PATTERNS) {
    const m = html.match(re);
    if (m) out[name] = m[0].replace(/[/"']+$/, "");
  }
  return out;
}

export function extractContacts(html: string, callingCode: string): ExtractedContacts {
  return {
    emails: extractEmails(html),
    phones: extractPhones(html, callingCode),
    whatsapp: extractWhatsapp(html, callingCode),
    socials: extractSocials(html),
  };
}

/** Brazilian mobile numbers (…+55 DD 9XXXX-XXXX) are WhatsApp-capable in practice; used only as a labeled heuristic. */
export function isLikelyMobile(e164: string | null | undefined): boolean {
  if (!e164) return false;
  if (e164.startsWith("+55")) return /^\+55\d{2}9\d{8}$/.test(e164);
  return false;
}
