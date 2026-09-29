import { describe, it, expect } from "vitest";
import { extractContacts, extractEmails, isLikelyMobile } from "./contact-extractor";
import { parseRobots, isAllowed } from "./robots";
import { verifyEmail } from "./email-verifier";
import { mergeContacts } from "./enrichment.logic";

const html = `
<html><body>
<a href="mailto:contato@barbearia.com.br?subject=oi">Email</a>
<p>Fale: (41) 99888-7766 ou tel:+554133334444</p>
<a href="https://wa.me/5541998887766">Whats</a>
<a href="https://api.whatsapp.com/send?phone=5541977776666&text=oi">Whats2</a>
<a href="https://www.instagram.com/barbeariadoze/">insta</a>
<a href="https://www.instagram.com/p/ABC">post</a>
<a href="https://facebook.com/barbeariadoze">fb</a>
<img src="logo@2x.png"> <span>vendas [at] barbearia [dot] com [dot] br</span>
<span>x@example.com sentry@sentry.io</span>
</body></html>`;

describe("contact extractor", () => {
  const c = extractContacts(html, "55");
  it("emails: mailto, obfuscated, no junk", () => {
    expect(c.emails).toContain("contato@barbearia.com.br");
    expect(c.emails).toContain("vendas@barbearia.com.br");
    expect(c.emails.some((e) => e.includes("example.com") || e.includes("sentry"))).toBe(false);
    expect(c.emails.some((e) => e.includes("logo@2x"))).toBe(false);
  });
  it("whatsapp from wa.me and api.whatsapp", () => {
    expect(c.whatsapp).toContain("+5541998887766");
    expect(c.whatsapp).toContain("+5541977776666");
  });
  it("phones normalized", () => {
    expect(c.phones).toContain("+5541998887766");
    expect(c.phones).toContain("+554133334444");
  });
  it("socials", () => {
    expect(c.socials.instagram).toBe("https://www.instagram.com/barbeariadoze");
    expect(c.socials.facebook).toContain("facebook.com/barbeariadoze");
  });
  it("extractEmails empty", () => expect(extractEmails("<p>nada</p>")).toEqual([]));
  it("mobile heuristic", () => {
    expect(isLikelyMobile("+5541998887766")).toBe(true);
    expect(isLikelyMobile("+554133334444")).toBe(false);
  });
});

describe("robots", () => {
  const txt = `User-agent: *\nDisallow: /admin\nDisallow: /private/\nAllow: /private/public\nCrawl-delay: 5\n\nUser-agent: badbot\nDisallow: /`;
  const r = parseRobots(txt);
  it("disallow", () => expect(isAllowed(r, "/admin/x")).toBe(false));
  it("allow default", () => expect(isAllowed(r, "/contato")).toBe(true));
  it("allow overrides longer match", () => expect(isAllowed(r, "/private/public/a")).toBe(true));
  it("crawl delay", () => expect(r.crawlDelaySec).toBe(5));
  it("full block for our agent", () => expect(isAllowed(parseRobots("User-agent: prospectorbot\nDisallow: /"), "/")).toBe(false));
  it("empty robots allows all", () => expect(isAllowed(parseRobots(""), "/x")).toBe(true));
});

describe("verifyEmail", () => {
  it("bad syntax", async () => expect((await verifyEmail("nope")).syntaxOk).toBe(false));
  it("mx ok", async () => expect((await verifyEmail("a@b.com", { resolveMx: async () => [{ exchange: "mx.b.com", priority: 1 }] })).mxOk).toBe(true));
  it("no mx", async () => expect((await verifyEmail("a@b.com", { resolveMx: async () => [] })).mxOk).toBe(false));
  it("ENOTFOUND", async () =>
    expect((await verifyEmail("a@b.com", { resolveMx: async () => { throw Object.assign(new Error("x"), { code: "ENOTFOUND" }); } })).mxOk).toBe(false));
  it("transient => null", async () =>
    expect((await verifyEmail("a@b.com", { resolveMx: async () => { throw Object.assign(new Error("x"), { code: "ETIMEOUT" }); } })).mxOk).toBeNull());
  it("smtp only when flagged", async () => {
    const r = await verifyEmail("a@b.com", { smtp: true, resolveMx: async () => [{ exchange: "mx", priority: 1 }], smtpProbe: async () => "valid" });
    expect(r.smtp).toBe("valid");
  });
});

describe("mergeContacts", () => {
  const base = { mapsPhoneE164: "+5541998887766", mapsSource: "gosom:maps_profile", mapsEmails: [], emailChecks: new Map() };
  it("every contact carries a source", () => {
    const r = mergeContacts({ ...base, pageContacts: [{ pageUrl: "https://x.com", contacts: extractContacts(html, "55") }] });
    expect(r.contacts.length).toBeGreaterThan(0);
    expect(r.contacts.every((c) => c.source.length > 0)).toBe(true);
    if (r.phone || r.whatsapp || r.email) expect(r.contactSource).toBeTruthy();
  });
  it("mobile maps phone becomes labeled whatsapp heuristic", () => {
    const r = mergeContacts({ ...base, pageContacts: [] });
    expect(r.whatsapp).toBe("+5541998887766");
    expect(r.contacts.find((c) => c.type === "whatsapp")?.verified).toBe("mobile_format_heuristic");
  });
  it("wa.me link on page preferred over heuristic", () => {
    const r = mergeContacts({ ...base, pageContacts: [{ pageUrl: "https://x.com", contacts: { emails: [], phones: [], whatsapp: ["+5541900000000"], socials: {} } }] });
    expect(r.whatsapp).toBe("+5541900000000");
  });
  it("drops emails failing MX", () => {
    const checks = new Map([["a@dead.com", { email: "a@dead.com", syntaxOk: true, mxOk: false, smtp: "skipped" as const }]]);
    const r = mergeContacts({ ...base, mapsEmails: ["a@dead.com"], emailChecks: checks, pageContacts: [] });
    expect(r.email).toBeNull();
  });
  it("no contacts => UNKNOWN and null source", () => {
    const r = mergeContacts({ ...base, mapsPhoneE164: null, pageContacts: [] });
    expect(r.contactSource).toBeNull();
    expect(r.ownerContactType).toBe("UNKNOWN");
  });
  it("never claims OWNER automatically", () => {
    const r = mergeContacts({ ...base, pageContacts: [] });
    expect(r.ownerContactType).toBe("BUSINESS");
  });
});
