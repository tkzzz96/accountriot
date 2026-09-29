import { describe, it, expect } from "vitest";
import { canonicalNiche } from "./niches";
import { pickDiverse, RefItem, thumbFor, hash } from "./selection";
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
