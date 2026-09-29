export interface RefItem {
  url: string;
  thumbUrl: string;
  source: string;
  niche: string;
  title: string;
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
export function pickDiverse(candidates: RefItem[], seed: string, n = 3): RefItem[] {
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
