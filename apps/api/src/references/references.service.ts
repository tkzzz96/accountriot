import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { canonicalNiche } from "./niches";
import { CURATED_SEED } from "./seed";
import { CuratedProvider } from "./providers/curated.provider";
import { PinterestProvider } from "./providers/pinterest.provider";
import { RefItem, pickDiverse, thumbFor } from "./selection";

@Injectable()
export class ReferencesService implements OnModuleInit {
  private readonly logger = new Logger(ReferencesService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private curated: CuratedProvider,
    private pinterest: PinterestProvider,
  ) {}

  private get thumbTemplate(): string | undefined {
    return this.config.get<string>("REFERENCE_THUMB_TEMPLATE") || undefined;
  }

  async onModuleInit(): Promise<void> {
    try {
      for (const s of CURATED_SEED) {
        await this.prisma.curatedReference.upsert({
          where: { niche_url: { niche: s.niche, url: s.url } },
          create: { niche: s.niche, language: "any", url: s.url, title: s.title, thumbUrl: thumbFor(s.url, this.thumbTemplate), source: "curated" },
          update: {},
        });
      }
    } catch (err) {
      this.logger.error(`Could not seed curated references: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async addCurated(input: { niche: string; url: string; title: string; language?: string; thumbUrl?: string }) {
    const niche = canonicalNiche(input.niche);
    const row = await this.prisma.curatedReference.upsert({
      where: { niche_url: { niche, url: input.url } },
      create: { niche, url: input.url, title: input.title, language: input.language ?? "any", thumbUrl: input.thumbUrl ?? thumbFor(input.url, this.thumbTemplate) },
      update: { title: input.title },
    });
    await this.prisma.referenceCache.deleteMany({ where: { niche } });
    return row;
  }

  list(niche?: string) {
    return this.prisma.curatedReference.findMany({ where: niche ? { niche: canonicalNiche(niche) } : {}, orderBy: [{ niche: "asc" }, { url: "asc" }] });
  }

  /** Candidate pool for (niche, language) — cached with TTL so a second campaign in the same niche does not search again. */
  async candidates(rawNiche: string, language: string): Promise<RefItem[]> {
    const niche = canonicalNiche(rawNiche);
    const cached = await this.prisma.referenceCache.findUnique({ where: { niche_language: { niche, language } } });
    if (cached && cached.expiresAt > new Date()) {
      this.logger.log(`references cache HIT niche=${niche} lang=${language}`);
      return cached.items as unknown as RefItem[];
    }
    this.logger.log(`references cache MISS niche=${niche} lang=${language} — searching providers`);
    let items = await this.curated.find(niche, language);
    if (items.length < 3) items = [...items, ...(await this.curated.find("generic", language))];
    if (this.pinterest.enabled) {
      try {
        items = [...items, ...(await this.pinterest.find(niche))];
      } catch (err) {
        this.logger.warn(`Pinterest provider failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    const ttlDays = Number(this.config.get<string>("REFERENCE_TTL_DAYS", "30"));
    const expiresAt = new Date(Date.now() + ttlDays * 86400_000);
    await this.prisma.referenceCache.upsert({
      where: { niche_language: { niche, language } },
      create: { niche, language, items: items as unknown as Prisma.InputJsonValue, expiresAt },
      update: { items: items as unknown as Prisma.InputJsonValue, expiresAt },
    });
    return items;
  }

  /** Three diverse references for one lead. */
  async forLead(leadId: string, niche: string, language: string): Promise<RefItem[]> {
    return pickDiverse(await this.candidates(niche, language), leadId, 3);
  }
}
