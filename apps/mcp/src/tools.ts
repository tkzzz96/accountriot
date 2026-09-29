import { z } from "zod";
import { ProspectorClient } from "./client";

export const createCampaignShape = {
  name: z.string(),
  niche: z.string().describe("e.g. barbearia"),
  city: z.string(),
  country: z.string().default("Brasil"),
  language: z.enum(["pt-BR", "en"]).default("pt-BR"),
  channel: z.enum(["whatsapp", "email"]).default("whatsapp"),
  requireNoSite: z.boolean().default(true),
  maxResults: z.number().int().min(1).max(200).default(50),
  radiusKm: z.number().optional(),
  service: z.string().optional(),
  priceAnchor: z.string().optional(),
  deadline: z.string().optional(),
  sellerName: z.string().optional(),
};

export const listLeadsShape = {
  campaignId: z.string().optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  q: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
};

export const getLeadShape = { leadId: z.string() };
export const regenerateShape = {
  leadId: z.string(),
  channel: z.enum(["whatsapp", "email"]).optional(),
  lang: z.enum(["pt-BR", "en"]).optional(),
};

type Lead = {
  id: string; name: string; score: number; priority: string; siteStatus: string; pipelineStage: string;
  phone?: string | null; whatsapp?: string | null; email?: string | null; budgetScore?: number;
  [k: string]: unknown;
};

export function summarizeLead(l: Lead) {
  return {
    id: l.id, name: l.name, score: l.score, priority: l.priority, siteStatus: l.siteStatus, stage: l.pipelineStage,
    contact: l.whatsapp ?? l.phone ?? l.email ?? null, budgetScore: l.budgetScore,
  };
}

export async function createCampaign(c: ProspectorClient, a: z.infer<z.ZodObject<typeof createCampaignShape>>) {
  const { name, ...filter } = a;
  const campaign = await c.request<{ id: string }>("POST", "/campaigns", { name, filter });
  await c.request("POST", `/scraper/campaigns/${campaign.id}/start`, {});
  return { campaignId: campaign.id, status: "queued" };
}

export async function listLeads(c: ProspectorClient, a: z.infer<z.ZodObject<typeof listLeadsShape>>) {
  const p = new URLSearchParams();
  if (a.campaignId) p.set("campaignId", a.campaignId);
  if (a.priority) p.set("priority", a.priority);
  if (a.q) p.set("q", a.q);
  p.set("limit", String(a.limit));
  const r = await c.request<{ data: Lead[]; total: number }>("GET", `/leads?${p}`);
  return { total: r.total, leads: r.data.map(summarizeLead) };
}

export const getLead = (c: ProspectorClient, a: { leadId: string }) => c.request("GET", `/leads/${a.leadId}`);

export const regenerateDraft = (c: ProspectorClient, a: z.infer<z.ZodObject<typeof regenerateShape>>) =>
  c.request("POST", `/leads/${a.leadId}/draft`, { channel: a.channel, lang: a.lang });
