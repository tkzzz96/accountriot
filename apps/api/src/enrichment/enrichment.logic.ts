import { ExtractedContacts, isLikelyMobile } from "./contact-extractor";
import { EmailVerification } from "./email-verifier";

export interface ContactEntry {
  type: "phone" | "whatsapp" | "email";
  value: string;
  source: string; // where it was found, e.g. "gosom:maps_profile" or "website:https://…"
  verified?: string; // e.g. "mx_ok", "smtp_valid", "mobile_format_heuristic"
}

export interface EnrichmentResult {
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  contactSource: string | null;
  ownerContactType: "OWNER" | "BUSINESS" | "UNKNOWN";
  contacts: ContactEntry[];
  socials: Record<string, string>;
}

/**
 * Merge the Maps-profile phone with contacts found on public pages.
 * Every contact carries its source; nothing is inferred beyond labeled heuristics.
 */
export function mergeContacts(input: {
  mapsPhoneE164: string | null;
  mapsSource: string;
  mapsEmails: string[];
  pageContacts: Array<{ pageUrl: string; contacts: ExtractedContacts }>;
  emailChecks: Map<string, EmailVerification>;
}): EnrichmentResult {
  const contacts: ContactEntry[] = [];
  const socials: Record<string, string> = {};
  const seen = new Set<string>();
  const add = (e: ContactEntry) => {
    const k = `${e.type}:${e.value}`;
    if (seen.has(k)) return;
    seen.add(k);
    contacts.push(e);
  };

  if (input.mapsPhoneE164) {
    add({ type: "phone", value: input.mapsPhoneE164, source: input.mapsSource });
    if (isLikelyMobile(input.mapsPhoneE164)) {
      add({ type: "whatsapp", value: input.mapsPhoneE164, source: input.mapsSource, verified: "mobile_format_heuristic" });
    }
  }
  for (const e of input.mapsEmails) add({ type: "email", value: e.toLowerCase(), source: input.mapsSource });
  for (const { pageUrl, contacts: c } of input.pageContacts) {
    const src = `website:${pageUrl}`;
    for (const w of c.whatsapp) add({ type: "whatsapp", value: w, source: src, verified: "wa_link_on_page" });
    for (const p of c.phones) add({ type: "phone", value: p, source: src });
    for (const e of c.emails) add({ type: "email", value: e, source: src });
    Object.assign(socials, c.socials);
  }

  // Drop e-mails that failed verification; annotate the rest.
  const finalContacts = contacts.filter((c) => {
    if (c.type !== "email") return true;
    const chk = input.emailChecks.get(c.value);
    if (!chk) return true;
    if (!chk.syntaxOk || chk.mxOk === false || chk.smtp === "invalid") return false;
    c.verified = chk.smtp === "valid" ? "smtp_valid" : chk.mxOk ? "mx_ok" : "unverified";
    return true;
  });

  // A wa.me link on the business's own page beats the mobile-format heuristic.
  const pick = (t: ContactEntry["type"]) => {
    const list = finalContacts.filter((c) => c.type === t);
    return list.find((c) => c.verified !== "mobile_format_heuristic") ?? list[0] ?? null;
  };
  const phone = pick("phone");
  const whatsapp = pick("whatsapp");
  const email = pick("email");
  const used = [phone, whatsapp, email].filter((c): c is ContactEntry => Boolean(c));
  const sources = [...new Set(used.map((c) => c.source))];

  return {
    phone: phone?.value ?? null,
    whatsapp: whatsapp?.value ?? null,
    email: email?.value ?? null,
    contactSource: sources.length ? sources.join("; ") : null,
    // Public business listings/pages are BUSINESS contacts; OWNER is only ever set manually.
    ownerContactType: used.length ? "BUSINESS" : "UNKNOWN",
    contacts: finalContacts,
    socials,
  };
}
