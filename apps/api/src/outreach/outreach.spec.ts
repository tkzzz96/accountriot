import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { buildContext, loadPrompt, mailtoLink, pickFact, render, siteSituation, templateDraft, validateDraft, waLink, LeadFacts, Channel, Lang } from "./outreach.logic";

const facts = (o: Partial<LeadFacts> = {}): LeadFacts => ({ name: "Barbearia do Zé", rating: 4.8, reviewCount: 250, siteStatus: "NONE", siteEvidence: null, ...o });
const offer = { niche: "barbearia", city: "Curitiba", service: "criação de site", priceAnchor: "a partir de R$ 1.500", deadline: "7 dias", sellerName: "Ryan" };
const combos: Array<[Channel, Lang]> = [["whatsapp", "pt-BR"], ["whatsapp", "en"], ["email", "pt-BR"], ["email", "en"]];
const statuses = ["NONE", "SOCIAL_ONLY", "FREE_BUILDER", "DEAD", "UNKNOWN"];

describe("prompts", () => {
  for (const [c, l] of combos) {
    it(`loads ${c}.${l} with version`, () => {
      const p = loadPrompt(c, l);
      expect(p.version).toBeGreaterThanOrEqual(1);
      expect(p.system.length).toBeGreaterThan(50);
      expect(p.user).toContain("{{businessName}}");
    });
  }
  it("render fills placeholders and marks missing", () => {
    const ctx = buildContext(facts(), { ...offer, priceAnchor: "" }, "pt-BR");
    const out = render(loadPrompt("whatsapp", "pt-BR").user, ctx);
    expect(out).toContain("Barbearia do Zé");
    expect(out).toContain("(n/d)");
    expect(out).not.toContain("{{");
  });
});

describe("facts", () => {
  it("cites rating when strong", () => expect(pickFact(facts(), "pt-BR")).toBe("nota 4,8 no Google com 250 avaliações"));
  it("english", () => expect(pickFact(facts(), "en")).toBe("4.8 stars on Google with 250 reviews"));
  it("falls back to site situation", () => expect(pickFact(facts({ rating: 3, reviewCount: 2 }), "pt-BR")).toContain("site"));
  it("social only names the host", () =>
    expect(siteSituation(facts({ siteStatus: "SOCIAL_ONLY", siteEvidence: { url: "https://instagram.com/x" } }), "pt-BR")).toContain("instagram.com"));
  it("never invents rating when missing", () => expect(pickFact(facts({ rating: null, reviewCount: null }), "pt-BR")).not.toMatch(/nota|avalia/));
});

describe("template drafts pass validation", () => {
  for (const [c, l] of combos) {
    for (const st of statuses) {
      it(`${c}/${l}/${st}`, () => {
        const ctx = buildContext(facts({ siteStatus: st, siteEvidence: { url: "https://x.wixsite.com/a" } }), offer, l);
        const t = templateDraft(c, l, ctx);
        const v = validateDraft(c, t.text, ctx, t.subject);
        expect(v.problems).toEqual([]);
      });
    }
  }
  it("does not mention price when absent", () => {
    const ctx = buildContext(facts(), { niche: "barbearia", city: "Curitiba" }, "pt-BR");
    expect(templateDraft("whatsapp", "pt-BR", ctx).text).not.toMatch(/R\$|em \d/);
  });
});

describe("validateDraft rejects bad drafts", () => {
  const ctx = buildContext(facts(), offer, "pt-BR");
  it("promises", () => expect(validateDraft("whatsapp", "Resultado garantido para Barbearia! Topa?", ctx).ok).toBe(false));
  it("too long", () => expect(validateDraft("whatsapp", "Barbearia " + "a".repeat(600) + "?", ctx).ok).toBe(false));
  it("no question", () => expect(validateDraft("whatsapp", "Oi Barbearia do Zé, faço sites.", ctx).ok).toBe(false));
  it("no fact about the business", () => expect(validateDraft("whatsapp", "Oi, faço sites. Quer ver?", ctx).ok).toBe(false));
  it("email needs subject", () => expect(validateDraft("email", "Barbearia, quer ver?", ctx).ok).toBe(false));
});

describe("links", () => {
  it("wa.me link encodes text and digits only", () => expect(waLink("+55 41 99888-7766", "olá & tudo?")).toBe("https://wa.me/5541998887766?text=ol%C3%A1%20%26%20tudo%3F"));
  it("no number => null", () => expect(waLink(null, "x")).toBeNull());
  it("mailto", () => expect(mailtoLink("a@b.com", "Assunto", "Corpo")).toBe("mailto:a@b.com?subject=Assunto&body=Corpo"));
  it("mailto none", () => expect(mailtoLink(null, "a", "b")).toBeNull());
});

describe("SAFETY: nothing in the codebase sends messages", () => {
  const srcRoot = path.resolve(__dirname, "..");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !p.endsWith(".spec.ts")) files.push(p);
    }
  };
  walk(srcRoot);
  const forbidden: Array<[string, RegExp]> = [
    ["nodemailer", /nodemailer/i],
    ["sendMail", /sendMail\s*\(/],
    ["twilio", /twilio/i],
    ["sendgrid", /sendgrid/i],
    ["mailgun", /mailgun/i],
    ["whatsapp cloud API", /graph\.facebook\.com/i],
    ["baileys/whatsapp-web.js", /baileys|whatsapp-web\.js/i],
    ["SMTP DATA command", /DATA\\r\\n/],
    ["messages.create", /messages\.create\s*\(/],
  ];
  for (const [label, re] of forbidden) {
    it(`no ${label} usage`, () => {
      const hits = files.filter((f) => re.test(fs.readFileSync(f, "utf8")));
      expect(hits.map((h) => path.relative(srcRoot, h))).toEqual([]);
    });
  }
  it("scanned a meaningful number of files", () => expect(files.length).toBeGreaterThan(30));
  it("drafts are always status=draft (type-level literal)", () => {
    const src = fs.readFileSync(path.join(__dirname, "outreach.logic.ts"), "utf8");
    expect(src).toContain('status: "draft"');
  });
});
