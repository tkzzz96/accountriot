export interface RefItem {
  url: string;
  thumbUrl: string;
  source: string;
  niche: string;
  title: string;
  /** true for rows owned by a workspace (vs the shared seed / external providers). Not persisted in the shared cache. */
  workspaceOwned?: boolean;
}

/** Cheap deterministic string hash → used to rotate picks per lead so all leads don't get the same 3. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** Picks `n` references that differ in host and (when possible) in source, rotated deterministically by seed. */
export function pickDiverse(candidates: RefItem[], seed: string, n = REFERENCES_PER_LEAD): RefItem[] {
  if (candidates.length === 0) return [];
  const start = hash(seed) % candidates.length;
  const rotated = [...candidates.slice(start), ...candidates.slice(0, start)];
  const picked: RefItem[] = [];
  const hosts = new Set<string>();
  const sources = new Map<string, number>();
  // Pass 1: unique host and unique source; Pass 2: unique host; Pass 3: anything left.
  for (const pass of [1, 2, 3]) {
    for (const c of rotated) {
      if (picked.length >= n) break;
      if (picked.some((p) => p.url === c.url)) continue;
      const h = hostOf(c.url);
      if (pass <= 2 && hosts.has(h)) continue;
      if (pass === 1 && (sources.get(c.source) ?? 0) > 0 && new Set(candidates.map((x) => x.source)).size > picked.length) continue;
      picked.push(c);
      hosts.add(h);
      sources.set(c.source, (sources.get(c.source) ?? 0) + 1);
    }
  }
  return picked;
}

export function thumbFor(url: string, template = "https://s0.wp.com/mshots/v1/{url}?w=640&h=400"): string {
  return template.replace("{url}", encodeURIComponent(url));
}

/** References attached to each lead. */
export const REFERENCES_PER_LEAD = 3;
/** Distinct candidates the pool should have before the generic fallback is skipped (kept equal to REFERENCES_PER_LEAD today, but a separate concern). */
export const MIN_REFERENCES = 3;

/**
 * Candidate pool: the workspace's own references first, then the shared pool; the generic fallback is used only when
 * fewer than `min` distinct references exist (own references count toward that minimum).
 */

export function mergePool(own: RefItem[], shared: RefItem[], generic: () => RefItem[], min = MIN_REFERENCES): RefItem[] {
  const seen = new Set<string>();
  const unique = (list: RefItem[]) => list.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
  let pool = unique([...own, ...shared]);
  if (pool.length < min) pool = [...pool, ...unique(generic())];
  return pool;
}

export interface SeedRow {
  niche: string;
  url: string;
  title: string;
  thumbUrl: string;
}
export interface ExistingSeedRow extends SeedRow {
  id: string;
}

/** Pure diff between the code's seed and the global rows in the DB: what to create, update, prune, and which niches' cache to drop. */
export function diffSeed(existing: ExistingSeedRow[], desired: SeedRow[], opts: { prune: boolean } = { prune: false }) {
  const key = (r: { niche: string; url: string }) => `${r.niche}|${r.url}`;
  const have = new Map(existing.map((r) => [key(r), r]));
  desired = [...new Map(desired.map((d) => [key(d), d])).values()]; // duplicate seed entries: last one wins, no flip-flopping
  const want = new Set(desired.map(key));
  const toCreate: SeedRow[] = [];
  const toUpdate: Array<{ id: string; title: string; thumbUrl: string }> = [];
  const niches = new Set<string>();
  for (const d of desired) {
    const row = have.get(key(d));
    if (!row) {
      toCreate.push(d);
      niches.add(d.niche);
    } else if (row.title !== d.title || row.thumbUrl !== d.thumbUrl) {
      toUpdate.push({ id: row.id, title: d.title, thumbUrl: d.thumbUrl });
      niches.add(d.niche);
    }
  }
  // Stale rows (removed from the code) are only reported — and only invalidate their niche — when pruning is enabled.
  const stale = opts.prune ? existing.filter((r) => !want.has(key(r))) : [];
  for (const r of stale) niches.add(r.niche);
  return { toCreate, toUpdate, staleIds: stale.map((r) => r.id), changedNiches: [...niches] };
}
