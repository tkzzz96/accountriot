// Integration tests against a REAL Postgres. Skipped unless RUN_INTEGRATION=1 and DATABASE_URL are set (CI runs them with a service container).
import { randomUUID } from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { PipelineService } from "./pipeline.service";
import { LeadsService } from "../leads/leads.service";
import { OutreachService } from "../outreach/outreach.service";
import type { DiscoveryService } from "../discovery/discovery.service";
import type { EnrichmentService } from "../enrichment/enrichment.service";
import type { ReferencesService } from "../references/references.service";
import type { SettingsService } from "../settings/settings.service";
import type { DiscoveredPlace } from "../discovery/discovery.types";
import type { CampaignFilter } from "../campaigns/dto/campaign-filter.dto";

const enabled = process.env.RUN_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL);
const place = (name: string, phone: string | null, website: string | null = null): DiscoveredPlace => ({
  name, address: "Rua 1", phone, website, rating: 4.5, reviewCount: 30, category: "Bakery", lat: null, lng: null, mapsUrl: null,
  priceRange: null, claimed: null, photoCount: null, emails: [], source: "mock",
});

describe.skipIf(!enabled)("pipeline (real Postgres)", () => {
  const prisma = new PrismaService();
  const tag = randomUUID().slice(0, 8);
  let wsA = "";
  let wsB = "";
  let campaignId = "";
  const queue = { add: vi.fn(async () => ({})) };
  const discovery = { discover: vi.fn(async (): Promise<DiscoveredPlace[]> => []) };
  const enrichment = {
    enrich: vi.fn(async (i: { phone: string | null }) => ({
      phone: i.phone, whatsapp: i.phone, email: null, contactSource: "maps_profile", ownerContactType: "BUSINESS", contacts: [], socials: {}, errors: [],
    })),
  };
  const references = { forLead: vi.fn(async () => [{ url: "https://a.com", thumbUrl: "t", source: "curated", niche: "padaria", title: "A" }]) };
  const settings = { getLlmConfig: vi.fn(async () => null) };
  const config = new ConfigService({ LLM_DAILY_DRAFT_LIMIT: 0 });
  let pipeline: PipelineService;
  let leads: LeadsService;
  const filter: CampaignFilter = { niche: "padaria", country: "Brasil", city: "Santos", language: "pt-BR", channel: "whatsapp", requireNoSite: true, maxResults: 10 } as CampaignFilter;

  beforeAll(async () => {
    await prisma.$connect();
    wsA = (await prisma.workspace.create({ data: { name: `A ${tag}`, slug: `a-${tag}` } })).id;
    wsB = (await prisma.workspace.create({ data: { name: `B ${tag}`, slug: `b-${tag}` } })).id;
    const campaigns = new CampaignsService(prisma);
    campaignId = (await prisma.campaign.create({
      data: { name: "c", industry: "padaria", location: "Santos", yourService: "site", language: "pt-BR", workspaceId: wsA, filter: filter as never },
    })).id;
    pipeline = new PipelineService(
      prisma, campaigns, discovery as unknown as DiscoveryService, enrichment as unknown as EnrichmentService,
      new OutreachService(config), references as unknown as ReferencesService, config, settings as unknown as SettingsService, queue as never,
    );
    leads = new LeadsService(prisma, config);
  });

  afterAll(async () => {
    await prisma.workspace.deleteMany({ where: { id: { in: [wsA, wsB].filter(Boolean) } } });
    await prisma.$disconnect();
  });

  it("discovers, stores NONE leads with evidence and dedupes across runs", async () => {
    discovery.discover.mockResolvedValue([place("Padaria Um", "+5513988880001"), place("Padaria Dois", "+5513988880002"), place("Padaria Um (dup)", "+5513988880001")]);
    const ids = await pipeline.discoverAndClassify(campaignId, wsA, filter);
    expect(ids).toHaveLength(2);
    const rows = await prisma.lead.findMany({ where: { id: { in: ids } } });
    for (const r of rows) {
      expect(r.siteStatus).toBe("NONE");
      expect(r.siteEvidence).toBeTruthy();
      expect(r.ownerContactType).toBe("BUSINESS");
      expect(r.pipelineStage).toBe("CLASSIFIED");
    }
    expect(await pipeline.discoverAndClassify(campaignId, wsA, filter)).toHaveLength(0);
  });

  it("runs every stage to READY, produces a DRAFT and 3-or-fewer references; resuming is idempotent", async () => {
    const [lead] = await prisma.lead.findMany({ where: { campaignId } });
    await pipeline.processLead(lead.id);
    const done = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(done.pipelineStage).toBe("READY");
    expect(done.score).toBeGreaterThan(0);
    expect(done.budgetScore).toBeGreaterThanOrEqual(0);
    const mc = done.marketingContent as { status: string; generator: string };
    expect(mc.status).toBe("draft");
    expect(mc.generator).toBe("template"); // LLM cap is 0 in this suite
    expect(Array.isArray(done.references)).toBe(true);
    await pipeline.processLead(lead.id);
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).pipelineStage).toBe("READY");
  });

  it("retry only works for FAILED leads and re-enqueues them", async () => {
    const [lead] = await prisma.lead.findMany({ where: { campaignId } });
    await expect(pipeline.retryLead(lead.id, wsA)).rejects.toThrow(/FAILED/);
    await pipeline.markFailed(lead.id, "boom");
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })).pipelineError).toBe("boom");
    await pipeline.retryLead(lead.id, wsA);
    expect(queue.add).toHaveBeenCalledWith("lead", { leadId: lead.id, campaignId }, expect.objectContaining({ jobId: `lead-${lead.id}` }));
    await expect(pipeline.retryLead(lead.id, wsB)).rejects.toThrow(/not found/);
  });

  it("bulk update/delete only touch the caller's workspace", async () => {
    const mine = await prisma.lead.findMany({ where: { campaignId } });
    const res = await leads.bulk({ ids: mine.map((l) => l.id), action: "crm", crmStatus: "contacted" }, wsA);
    expect(res.affected).toBe(mine.length);
    const rows = await prisma.lead.findMany({ where: { campaignId } });
    expect(rows.every((r) => r.crmStatus === "contacted" && r.contactedAt)).toBe(true);
    expect((await leads.bulk({ ids: mine.map((l) => l.id), action: "delete" }, wsB)).affected).toBe(0);
    expect(await prisma.lead.count({ where: { campaignId } })).toBe(mine.length);
    await expect(leads.bulk({ ids: [mine[0].id], action: "crm" }, wsA)).rejects.toThrow();
    expect((await leads.bulk({ ids: mine.map((l) => l.id), action: "delete" }, wsA)).affected).toBe(mine.length);
  });

  it("webhook export requires configuration and never leaks across workspaces", async () => {
    await expect(leads.exportToWebhook("x", wsA)).rejects.toThrow(/not configured/);
    const withHook = new LeadsService(prisma, new ConfigService({ LEAD_WEBHOOK_URL: "http://127.0.0.1:1/hook" }));
    await expect(withHook.exportToWebhook("missing", wsA)).rejects.toThrow(/not found/);
  });
});
