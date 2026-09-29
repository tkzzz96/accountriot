import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CampaignsService } from "../campaigns/campaigns.service";
import { DiscoveryService } from "../discovery/discovery.service";
import { classifySite } from "../site-check/site-classifier";
import { httpProbe } from "../site-check/http-probe";
import { countryCallingCode } from "../common/util/normalize";
import { CampaignFilter } from "../campaigns/dto/campaign-filter.dto";
import { dedupePlaces, placeToLeadData, shouldKeep } from "./lead-mapping";
import { DiscoveredPlace } from "../discovery/discovery.types";

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
}
