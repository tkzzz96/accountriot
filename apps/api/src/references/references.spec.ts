import { describe, it, expect } from "vitest";
import { canonicalNiche } from "./niches";
import { pickDiverse, mergePool, diffSeed, MIN_REFERENCES, RefItem, thumbFor, hash } from "./selection";
import { CURATED_SEED } from "./seed";

const item = (url: string, source = "curated"): RefItem => ({ url, thumbUrl: thumbFor(url), source, niche: "x", title: url });

describe("canonicalNiche", () => {
  const cases: Array<[string, string]> = [
    ["barbearia", "barbershop"], ["Barbershop", "barbershop"], ["restaurante japonês", "restaurant"], ["Cafeteria", "cafe"],
    ["dentista", "dentist"], ["Clínica de estética", "clinic"], ["academia de musculação", "gym"], ["Salão de beleza", "salon"],
    ["advogado trabalhista", "lawyer"], ["pet shop", "petshop"], ["oficina mecânica", "automotive"], ["imobiliária", "realestate"],
    ["loja de roupas", "store"], ["floricultura", "generic"], ["", "generic"],
  ];
  for (const [input, expected] of cases) it(`${input || "(empty)"} -> ${expected}`, () => expect(canonicalNiche(input)).toBe(expected));
});

describe("pickDiverse", () => {
  const pool = Array.from({ length: 8 }, (_, i) => item(`https://site${i}.com`));
  it("returns exactly 3 when >=3 available", () => expect(pickDiverse(pool, "lead1")).toHaveLength(3));
  it("returns all when fewer than 3", () => expect(pickDiverse(pool.slice(0, 2), "l")).toHaveLength(2));
  it("empty pool", () => expect(pickDiverse([], "l")).toEqual([]));
  it("no duplicate urls", () => {
    const r = pickDiverse(pool, "abc");
    expect(new Set(r.map((x) => x.url)).size).toBe(3);
  });
  it("prefers different hosts", () => {
    const dup = [item("https://a.com/1"), item("https://www.a.com/2"), item("https://b.com"), item("https://c.com")];
    const hosts = pickDiverse(dup, "z").map((x) => new URL(x.url).hostname.replace(/^www\./, ""));
    expect(new Set(hosts).size).toBe(3);
  });
  it("mixes sources when available", () => {
    const mixed = [item("https://a.com", "curated"), item("https://b.com", "curated"), item("https://c.com", "pinterest"), item("https://d.com", "curated")];
    const sources = new Set(pickDiverse(mixed, "q").map((x) => x.source));
    expect(sources.size).toBeGreaterThan(1);
  });
  it("is deterministic per seed", () => expect(pickDiverse(pool, "same")).toEqual(pickDiverse(pool, "same")));
  it("rotates across leads", () => {
    const sets = new Set(Array.from({ length: 20 }, (_, i) => pickDiverse(pool, `lead${i}`).map((x) => x.url).join(",")));
    expect(sets.size).toBeGreaterThan(1);
  });
  it("hash stable", () => expect(hash("a")).toBe(hash("a")));
});

describe("thumbFor / seed", () => {
  it("encodes url into template", () => expect(thumbFor("https://a.com/x?y=1")).toContain(encodeURIComponent("https://a.com/x?y=1")));
  it("custom template", () => expect(thumbFor("https://a.com", "https://t/{url}")).toBe("https://t/https%3A%2F%2Fa.com"));
  it("seed has >=3 per niche and valid https urls", () => {
    const by: Record<string, number> = {};
    for (const s of CURATED_SEED) {
      expect(s.url).toMatch(/^https:\/\//);
      by[s.niche] = (by[s.niche] ?? 0) + 1;
    }
    for (const [n, c] of Object.entries(by)) expect(c, n).toBeGreaterThanOrEqual(3);
    expect(by.generic).toBeGreaterThanOrEqual(3);
  });
  it("seed has no duplicate (niche,url)", () => {
    const keys = CURATED_SEED.map((s) => `${s.niche}|${s.url}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("mergePool", () => {
  const mk = (n: number, prefix = "s") => Array.from({ length: n }, (_, i) => item(`https://${prefix}${i}.com`));
  it("own references come first", () => expect(mergePool(mk(1, "own"), mk(2), () => mk(5, "g"))[0].url).toBe("https://own0.com"));
  it("3 own references are enough: no generic fallback", () => {
    const pool = mergePool(mk(3, "own"), [], () => mk(5, "g"));
    expect(pool.map((r) => r.url).some((u) => u.includes("g0"))).toBe(false);
  });
  it("falls back to generic only when fewer than 3 distinct", () => {
    expect(mergePool(mk(1, "own"), mk(1), () => mk(2, "g")).length).toBe(4);
    expect(mergePool([], mk(3), () => mk(2, "g")).length).toBe(3);
  });
  it("dedupes a workspace copy of a seeded URL (own wins) and counts distinct URLs for the threshold", () => {
    const own = [{ ...item("https://dup.com"), title: "mine" }];
    const shared = [item("https://dup.com"), item("https://other.com")];
    const pool = mergePool(own, shared, () => mk(1, "g"));
    expect(pool.filter((r) => r.url === "https://dup.com")).toHaveLength(1);
    expect(pool.find((r) => r.url === "https://dup.com")?.title).toBe("mine");
    expect(pool).toHaveLength(3); // 2 distinct + 1 generic
  });
});

describe("diffSeed (boot-time seed sync)", () => {
  const row = (niche: string, url: string, title = "T", thumbUrl = "th", id = `${niche}-${url}`) => ({ id, niche, url, title, thumbUrl });
  const want = (niche: string, url: string, title = "T", thumbUrl = "th") => ({ niche, url, title, thumbUrl });
  it("no drift => nothing to do", () => {
    const d = diffSeed([row("a", "u1")], [want("a", "u1")]);
    expect(d).toEqual({ toCreate: [], toUpdate: [], staleIds: [], changedNiches: [] });
  });
  it("new entries are created and invalidate only their niche", () => {
    const d = diffSeed([row("a", "u1")], [want("a", "u1"), want("b", "u2")]);
    expect(d.toCreate).toEqual([want("b", "u2")]);
    expect(d.changedNiches).toEqual(["b"]);
  });
  it("title or thumbnail drift is updated in place", () => {
    const d = diffSeed([row("a", "u1", "Old"), row("a", "u2", "T", "oldthumb")], [want("a", "u1", "New"), want("a", "u2")]);
    expect(d.toUpdate.map((u) => u.title)).toEqual(["New", "T"]);
    expect(d.toUpdate[1].thumbUrl).toBe("th");
    expect(d.changedNiches).toEqual(["a"]);
  });
  it("entries removed from the code are pruned and their niche invalidated", () => {
    const d = diffSeed([row("a", "u1"), row("c", "gone", "T", "th", "id-gone")], [want("a", "u1")]);
    expect(d.staleIds).toEqual(["id-gone"]);
    expect(d.changedNiches).toEqual(["c"]);
  });
  it("same URL under two niches is two distinct rows", () => {
    const d = diffSeed([row("a", "u1")], [want("a", "u1"), want("b", "u1")]);
    expect(d.toCreate).toEqual([want("b", "u1")]);
  });
  it("MIN_REFERENCES is the single source of truth for the fallback threshold", () => {
    expect(MIN_REFERENCES).toBe(3);
    expect(mergePool([], [item("https://a.com"), item("https://b.com")], () => [item("https://g.com")]).length).toBe(3);
  });
});
