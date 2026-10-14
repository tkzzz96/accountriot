import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { canonicalNiche } from "./niches";
import { CURATED_SEED } from "./seed";
import { CuratedProvider } from "./providers/curated.provider";
import { PinterestProvider } from "./providers/pinterest.provider";
import { MIN_REFERENCES, REFERENCES_PER_LEAD, RefItem, diffSeed, mergePool, pickDiverse, thumbFor } from "./selection";

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
      const existing = await this.prisma.curatedReference.findMany({ where: { workspaceId: "" } });
      const desired = CURATED_SEED.map((x) => ({ niche: x.niche, url: x.url, title: x.title, thumbUrl: thumbFor(x.url, this.thumbTemplate) }));
      const d = diffSeed(existing, desired, { prune: this.config.get<string>("REFERENCE_PRUNE_SEED", "false") === "true" });
      if (!d.toCreate.length && !d.toUpdate.length && !d.staleIds.length) return;
      await this.prisma.$transaction([
        ...d.toUpdate.map((u) => this.prisma.curatedReference.update({ where: { id: u.id }, data: { title: u.title, thumbUrl: u.thumbUrl } })),
        this.prisma.curatedReference.createMany({
          data: d.toCreate.map((r) => ({ workspaceId: "", language: "any", source: "curated", ...r })),
          skipDuplicates: true,
        }),
        // With REFERENCE_PRUNE_SEED=true, entries removed from the code are removed from the shared list (workspace rows are never touched).
        this.prisma.curatedReference.deleteMany({ where: { id: { in: d.staleIds }, workspaceId: "" } }),
        // Changed rows must not wait for the cache TTL; only the affected niches are invalidated.
        this.prisma.referenceCache.deleteMany({ where: { niche: { in: d.changedNiches } } }),
      ]);
    } catch (err) {
      this.logger.error(`Could not seed curated references: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async addCurated(workspaceId: string, input: { niche: string; url: string; title: string; language?: string; thumbUrl?: string }) {
    const niche = canonicalNiche(input.niche);
    const row = await this.prisma.curatedReference.upsert({
      where: { workspaceId_niche_url: { workspaceId, niche, url: input.url } },
      create: { workspaceId, niche, url: input.url, title: input.title, language: input.language ?? "any", thumbUrl: input.thumbUrl ?? thumbFor(input.url, this.thumbTemplate) },
      update: { title: input.title },
    });
        return row;
  }

  list(workspaceId: string, niche?: string) {
    return this.prisma.curatedReference.findMany({ where: { workspaceId: { in: ["", workspaceId] }, ...(niche && { niche: canonicalNiche(niche) }) }, orderBy: [{ niche: "asc" }, { url: "asc" }] });
  }

  /**
   * Candidate pool for (workspace, niche, language).
   * - the shared pool (global seed + external providers such as Pinterest) is cached per (niche, language) with a TTL, so
   *   N workspaces in the same niche trigger ONE external search;
   * - the workspace's own curated references are read live (cheap DB query) and win over shared ones.
   */
  async candidates(workspaceId: string, rawNiche: string, language: string): Promise<RefItem[]> {
    const niche = canonicalNiche(rawNiche);
    const [own, shared] = await Promise.all([
      workspaceId ? this.curated.find(niche, language, workspaceId).then((rows) => rows.filter((r) => r.workspaceOwned)) : Promise.resolve([] as RefItem[]),
      this.sharedPool(niche, language),
    ]);
    const pool = mergePool(own, shared, () => []);
    if (pool.length >= MIN_REFERENCES || niche === "generic") return pool;
    // Generic fallback comes from the cached shared pool (curated only: no external search is ever made for "generic").
    const generic = await this.sharedPool("generic", language);
    return mergePool(own, shared, () => generic);
  }

  private async sharedPool(niche: string, language: string): Promise<RefItem[]> {
    const cached = await this.prisma.referenceCache.findUnique({ where: { niche_language: { niche, language } } });
    if (cached && cached.expiresAt > new Date()) {
      this.logger.log(`references cache HIT niche=${niche} lang=${language}`);
      return cached.items as unknown as RefItem[];
    }
    this.logger.log(`references cache MISS niche=${niche} lang=${language} — searching providers`);
    let items = await this.curated.find(niche, language, "");
    if (this.pinterest.enabled && niche !== "generic") {
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
  async forLead(workspaceId: string, leadId: string, niche: string, language: string): Promise<RefItem[]> {
    return pickDiverse(await this.candidates(workspaceId, niche, language), leadId, REFERENCES_PER_LEAD);
  }
}
