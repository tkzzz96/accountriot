import { createHmac } from "crypto";

export interface WebhookLead {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  category: string | null;
  rating: string | null;
  reviewCount: number | null;
  siteStatus: string;
  siteEvidence: unknown;
  score: number;
  priority: string;
  budgetScore: number;
  budgetSignals: unknown;
  contactSource: string | null;
  ownerContactType: string;
  crmStatus: string;
  crmNotes: string | null;
  references: unknown;
  marketingContent: unknown;
  campaignId: string;
}

/**
 * Body sent to the optional CRM webhook (Twenty, n8n, Zapier…). Contains exactly what the CRM needs to store a lead; the message
 * stays a DRAFT (`draft.status === "draft"`) — the webhook never triggers sending (CLAUDE.md rule 1).
 */
export function leadWebhookPayload(lead: WebhookLead, now: Date = new Date()) {
  const mc = (lead.marketingContent ?? {}) as { text?: string; subject?: string; channel?: string; lang?: string; status?: string };
  return {
    event: "lead.export",
    sentAt: now.toISOString(),
    lead: {
      id: lead.id,
      name: lead.name,
      address: lead.address,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      email: lead.email,
      website: lead.website,
      category: lead.category,
      rating: lead.rating,
      reviewCount: lead.reviewCount,
      siteStatus: lead.siteStatus,
      siteEvidence: lead.siteEvidence,
      score: lead.score,
      priority: lead.priority,
      budgetScore: lead.budgetScore,
      budgetSignals: lead.budgetSignals,
      contactSource: lead.contactSource,
      ownerContactType: lead.ownerContactType,
      crmStatus: lead.crmStatus,
      crmNotes: lead.crmNotes,
      campaignId: lead.campaignId,
      references: lead.references,
    },
    draft: { status: "draft" as const, channel: mc.channel ?? null, lang: mc.lang ?? null, subject: mc.subject ?? null, text: mc.text ?? null },
  };
}

/** HMAC-SHA256 of the raw body, formatted as the `X-Prospector-Signature` header value. */
export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}
