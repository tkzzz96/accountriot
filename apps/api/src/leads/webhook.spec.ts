import { describe, expect, it } from "vitest";
import { leadWebhookPayload, signBody, WebhookLead } from "./webhook";

const lead: WebhookLead = {
  id: "l1", name: "Padaria X", address: "Rua 1", phone: "+5511999990000", whatsapp: null, email: null, website: null, category: "bakery",
  rating: "4.5", reviewCount: 10, siteStatus: "NONE", siteEvidence: { code: "NO_URL" }, score: 80, priority: "HIGH", budgetScore: 60,
  budgetSignals: { label: "provável" }, contactSource: "maps_profile", ownerContactType: "BUSINESS", crmStatus: "new", crmNotes: null,
  references: [], marketingContent: { text: "Oi!", channel: "whatsapp", lang: "pt-BR", status: "draft" }, campaignId: "c1",
};

describe("leadWebhookPayload", () => {
  it("always marks the message as a draft and carries evidence + contact provenance", () => {
    const p = leadWebhookPayload(lead, new Date("2026-01-01T00:00:00Z"));
    expect(p.event).toBe("lead.export");
    expect(p.sentAt).toBe("2026-01-01T00:00:00.000Z");
    expect(p.draft).toEqual({ status: "draft", channel: "whatsapp", lang: "pt-BR", subject: null, text: "Oi!" });
    expect(p.lead.siteEvidence).toEqual({ code: "NO_URL" });
    expect(p.lead.ownerContactType).toBe("BUSINESS");
    expect(p.lead.contactSource).toBe("maps_profile");
  });
  it("handles leads without a draft", () => {
    expect(leadWebhookPayload({ ...lead, marketingContent: null }).draft.text).toBeNull();
  });
});

describe("signBody", () => {
  it("is a deterministic sha256 HMAC", () => {
    expect(signBody("x", "s")).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(signBody("x", "s")).toBe(signBody("x", "s"));
    expect(signBody("x", "s")).not.toBe(signBody("y", "s"));
    expect(signBody("x", "s")).not.toBe(signBody("x", "t"));
  });
});
