import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { DiscoveryService } from "../discovery/discovery.service";
import { classifySite } from "../site-check/site-classifier";
import { httpProbe } from "../site-check/http-probe";
import { countryCallingCode } from "../common/util/normalize";
import { CampaignFilter } from "../campaigns/dto/campaign-filter.dto";
import { dedupePlaces, placeToLeadData, shouldKeep } from "./lead-mapping";
import { DiscoveredPlace } from "../discovery/discovery.types";
import { EnrichmentService } from "../enrichment/enrichment.service";
import { scoreLead } from "../scoring/scoring";
import { budgetSignals } from "../scoring/budget-signals";
import { Prisma } from "@prisma/client";
import { ReferencesService } from "../references/references.service";
import { OutreachService } from "../outreach/outreach.service";
import { Channel, Lang } from "../outreach/outreach.logic";

type Json = Record<string, unknown>;

async function mapPool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private prisma: PrismaService,
    private campaigns: CampaignsService,
    private discovery: DiscoveryService,
    private enrichment: EnrichmentService,
    private outreach: OutreachService,
    private references: ReferencesService,
  ) {}

  /** Discover + classify + persist. Returns ids of created leads. */
  async discoverAndClassify(campaignId: string, workspaceId: string, filter: CampaignFilter): Promise<string[]> {
    const code = countryCallingCode(filter.country);
    const maxResults = filter.maxResults ?? 50;
    await this.campaigns.updateStatus(campaignId, "running", 5);

    const found: DiscoveredPlace[] = await this.discovery.discover({
      niche: filter.niche,
      country: filter.country,
      city: filter.city,
      radiusKm: filter.radiusKm,
      lat: filter.lat,
      lng: filter.lng,
      maxResults,
      language: filter.language,
    });
    const places = dedupePlaces(found, code);
    this.logger.log(`Campaign ${campaignId}: ${found.length} discovered, ${places.length} after dedupe`);
    await this.campaigns.updateStatus(campaignId, "running", 20);

    const classified = await mapPool(places, 8, async (place) => ({
      place,
      site: await classifySite(place.website, httpProbe),
    }));
    await this.campaigns.updateStatus(campaignId, "running", 40);

    const ids: string[] = [];
    for (const { place, site } of classified) {
      if (!shouldKeep(site.status, filter.requireNoSite)) continue;
      const data = placeToLeadData(place, site, code);
      const existing = await this.prisma.lead.findFirst({ where: { workspaceId, dedupeKey: data.dedupeKey } });
      if (existing) continue; // already known in this workspace (dedupe)
      const created = await this.prisma.lead.create({ data: { ...data, workspaceId, campaignId } });
      ids.push(created.id);
    }
    this.logger.log(`Campaign ${campaignId}: ${ids.length} new leads stored`);
    return ids;
  }

  /** Runs the remaining stages for one lead, resuming from its persisted stage (idempotent on retry). */
  async processLead(leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findUnique({ where: { id: leadId }, include: { campaign: true } });
    if (!lead) return;
    const filter = (lead.campaign.filter ?? {}) as unknown as CampaignFilter;
    const code = countryCallingCode(filter.country);
    const analysis = (lead.aiAnalysis ?? {}) as Json;
    const signals = (analysis.signals ?? {}) as Json;

    if (lead.pipelineStage === "CLASSIFIED" || lead.pipelineStage === "DISCOVERED") {
      const e = await this.enrichment.enrich({
        phone: lead.phone,
        mapsSource: lead.contactSource ?? `${lead.source}:maps_profile`,
        mapsEmails: (signals.emails as string[]) ?? [],
        website: lead.website,
        siteStatus: lead.siteStatus,
        callingCode: code,
      });
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          phone: e.phone ?? lead.phone,
          whatsapp: e.whatsapp,
          email: e.email,
          contactSource: e.contactSource,
          ownerContactType: e.ownerContactType,
          pipelineStage: "ENRICHED",
          aiAnalysis: { ...analysis, enrichment: { contacts: e.contacts, socials: e.socials, notes: e.errors } } as unknown as Prisma.InputJsonValue,
        },
      });
      lead.pipelineStage = "ENRICHED";
      Object.assign(analysis, { enrichment: { contacts: e.contacts, socials: e.socials, notes: e.errors } });
      lead.whatsapp = e.whatsapp;
      lead.email = e.email;
      lead.phone = e.phone ?? lead.phone;
    }

    if (lead.pipelineStage === "ENRICHED") {
      const enr = (analysis.enrichment ?? {}) as { socials?: Record<string, string> };
      const hasSocial = Object.keys(enr.socials ?? {}).length > 0 || lead.siteStatus === "SOCIAL_ONLY";
      const rating = lead.rating ? parseFloat(lead.rating) : null;
      const s = scoreLead({
        siteStatus: lead.siteStatus,
        hasWhatsapp: Boolean(lead.whatsapp),
        hasPhone: Boolean(lead.phone),
        hasEmail: Boolean(lead.email),
        rating: rating != null && !Number.isNaN(rating) ? rating : null,
        reviewCount: lead.reviewCount,
        claimed: (signals.claimed as boolean | null) ?? null,
        hasSocial,
        category: lead.category,
        name: lead.name,
        niche: filter.niche ?? lead.campaign.industry,
      });
      const b = budgetSignals({
        priceRange: (signals.priceRange as string | null) ?? null,
        reviewCount: lead.reviewCount,
        rating,
        photoCount: (signals.photoCount as number | null) ?? null,
        claimed: (signals.claimed as boolean | null) ?? null,
        hasSocial,
        sizeHint: filter.sizeHint,
        budgetUsd: filter.budgetUsd,
      });
      const next = { ...analysis, score: { tier: s.tier, preset: s.preset, breakdown: s.breakdown } };
      await this.prisma.lead.update({
        where: { id: leadId },
        data: {
          score: s.score,
          priority: s.priority,
          budgetScore: b.budgetScore,
          budgetSignals: { label: b.label, disclaimer: b.disclaimer, signals: b.signals } as unknown as Prisma.InputJsonValue,
          pipelineStage: "SCORED",
          aiAnalysis: next as unknown as Prisma.InputJsonValue,
        },
      });
      lead.pipelineStage = "SCORED";
    }

    if (lead.pipelineStage === "SCORED") {
      await this.draftForLead(leadId);
      lead.pipelineStage = "DRAFTED";
    }

    if (lead.pipelineStage === "DRAFTED") {
      const refs = await this.references.forLead(leadId, filter.niche ?? lead.campaign.industry, filter.language ?? "pt-BR");
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { references: refs as unknown as Prisma.InputJsonValue, pipelineStage: "READY", pipelineError: null },
      });
    }
  }

  /** (Re)generates the message DRAFT for a lead. Never sends anything. */
  async draftForLead(leadId: string, workspaceId?: string, channel?: Channel, lang?: Lang) {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, ...(workspaceId && { workspaceId }) }, include: { campaign: true } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    const filter = (lead.campaign.filter ?? {}) as unknown as CampaignFilter;
    const ch: Channel = channel ?? (filter.channel === "email" ? "email" : "whatsapp");
    const lg: Lang = lang ?? (filter.language === "en" ? "en" : "pt-BR");
    const rating = lead.rating ? parseFloat(lead.rating) : null;
    const draft = await this.outreach.draft(
      {
        name: lead.name,
        rating: rating != null && !Number.isNaN(rating) ? rating : null,
        reviewCount: lead.reviewCount,
        siteStatus: lead.siteStatus,
        siteEvidence: lead.siteEvidence as { url?: string | null; reason?: string } | null,
      },
      {
        niche: filter.niche ?? lead.campaign.industry,
        city: filter.city ?? lead.campaign.location,
        service: filter.service ?? lead.campaign.yourService,
        priceAnchor: filter.priceAnchor,
        deadline: filter.deadline,
        sellerName: filter.sellerName,
      },
      ch,
      lg,
    );
    // Keep one draft per channel so regenerating email does not erase the WhatsApp draft.
    const prev = (lead.marketingContent ?? {}) as { drafts?: Record<string, unknown> };
    const drafts = { ...(prev.drafts ?? {}), [ch]: draft };
    await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        marketingContent: { ...draft, drafts } as unknown as Prisma.InputJsonValue,
        pipelineStage: lead.pipelineStage === "SCORED" ? "DRAFTED" : lead.pipelineStage,
      },
    });
    return draft;
  }

  /** LGPD/GDPR: permanently erase a lead and its activities. */
  async deleteLead(leadId: string, workspaceId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);
    await this.prisma.lead.delete({ where: { id: leadId } });
  }

  async markFailed(leadId: string, reason: string): Promise<void> {
    await this.prisma.lead.update({ where: { id: leadId }, data: { pipelineStage: "FAILED", pipelineError: reason.slice(0, 500) } });
  }

  /** Finalizes campaign stats once every lead reached READY or FAILED. */
  async finalizeCampaignIfDone(campaignId: string): Promise<void> {
    const pending = await this.prisma.lead.count({ where: { campaignId, pipelineStage: { notIn: ["READY", "FAILED"] } } });
    const total = await this.prisma.lead.count({ where: { campaignId } });
    if (pending > 0) {
      const pct = 40 + Math.round(((total - pending) / Math.max(1, total)) * 59);
      await this.campaigns.updateStatus(campaignId, "running", pct);
      return;
    }
    const agg = await this.prisma.lead.aggregate({ where: { campaignId }, _avg: { score: true } });
    const priority = await this.prisma.lead.count({ where: { campaignId, priority: "HIGH" } });
    const hq = await this.prisma.lead.count({ where: { campaignId, score: { gte: 70 } } });
    await this.campaigns.updateStats(campaignId, {
      totalLeads: total,
      priorityLeads: priority,
      highQualityLeads: hq,
      averageScore: Math.round(agg._avg.score ?? 0),
    });
    await this.campaigns.updateStatus(campaignId, "completed", 100);
  }
}
