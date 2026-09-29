import { describe, it, expect } from "vitest";
import { scoreLead, smoothedRating, categoryMatches, ScoreInput } from "./scoring";
import { budgetSignals } from "./budget-signals";

const ideal: ScoreInput = {
  siteStatus: "NONE", hasWhatsapp: true, hasPhone: true, hasEmail: true, rating: 4.8, reviewCount: 250,
  claimed: false, hasSocial: true, category: "Barbearia", name: "Barbearia do Zé", niche: "barbearia",
};
const bad: ScoreInput = {
  siteStatus: "HAS_SITE", hasWhatsapp: false, hasPhone: false, hasEmail: false, rating: 2.5, reviewCount: 1,
  claimed: true, hasSocial: false, category: "Farmácia", name: "Drogaria X", niche: "barbearia",
};

describe("scoreLead", () => {
  it("ideal lead is HOT and near 100", () => {
    const r = scoreLead(ideal);
    expect(r.tier).toBe("HOT");
    expect(r.priority).toBe("HIGH");
    expect(r.score).toBeGreaterThanOrEqual(90);
  });
  it("bad lead is COLD and near 0", () => {
    const r = scoreLead(bad);
    expect(r.tier).toBe("COLD");
    expect(r.score).toBeLessThanOrEqual(10);
  });
  it("ideal outranks bad", () => expect(scoreLead(ideal).score).toBeGreaterThan(scoreLead(bad).score));
  it("breakdown explains every factor and sums to score", () => {
    const r = scoreLead(ideal);
    expect(r.breakdown).toHaveLength(7);
    expect(r.breakdown.every((b) => b.reason.length > 0)).toBe(true);
    expect(Math.round(r.breakdown.reduce((s, b) => s + b.points, 0))).toBe(r.score);
  });
  it("each factor never exceeds its max", () => {
    for (const b of scoreLead(ideal).breakdown) expect(b.points).toBeLessThanOrEqual(b.max);
  });
  it("no site is worth more than a social-only presence", () => {
    const a = scoreLead({ ...ideal, siteStatus: "NONE" }).score;
    const b = scoreLead({ ...ideal, siteStatus: "SOCIAL_ONLY" }).score;
    expect(a).toBeGreaterThan(b);
  });
  it("whatsapp beats phone-only", () =>
    expect(scoreLead({ ...ideal, hasWhatsapp: true }).score).toBeGreaterThan(scoreLead({ ...ideal, hasWhatsapp: false }).score));
  it("weight override changes result", () => {
    const base = scoreLead(bad).score;
    const boosted = scoreLead(bad, "agency_opportunity", { rating: 0, reviews: 0, contactability: 0, siteGap: 0, categoryMatch: 0, socialPresence: 0, unclaimedProfile: 0 }).score;
    expect(boosted).toBeLessThanOrEqual(base);
  });
  it("unknown preset falls back to default", () => expect(scoreLead(ideal, "nope").preset).toBe("nope"));
});

describe("helpers", () => {
  it("smoothed rating: 5★ with 1 review < 4.5★ with 500", () =>
    expect(smoothedRating(5, 1)).toBeLessThan(smoothedRating(4.5, 500)));
  it("categoryMatches accent/plural insensitive", () => expect(categoryMatches("barbearias", "Barbearia", "X")).toBe(true));
  it("categoryMatches negative", () => expect(categoryMatches("barbearia", "Farmácia", "Drogaria")).toBe(false));
});

describe("budgetSignals", () => {
  const rich = { priceRange: "$$$", reviewCount: 400, rating: 4.7, photoCount: 12, claimed: true, hasSocial: true, sizeHint: "medium" };
  const poor = { priceRange: null, reviewCount: 2, rating: 3.0, photoCount: 0, claimed: false, hasSocial: false, sizeHint: "micro" };
  it("rich => provável", () => expect(budgetSignals(rich).label).toBe("provável"));
  it("poor => improvável", () => expect(budgetSignals(poor).label).toBe("improvável"));
  it("score bounded 0..100", () => {
    for (const i of [rich, poor]) {
      const r = budgetSignals(i);
      expect(r.budgetScore).toBeGreaterThanOrEqual(0);
      expect(r.budgetScore).toBeLessThanOrEqual(100);
    }
  });
  it("always carries the estimate disclaimer and signals", () => {
    const r = budgetSignals(rich);
    expect(r.disclaimer).toMatch(/Estimativa/);
    expect(r.signals.length).toBeGreaterThan(3);
  });
  it("high ticket lowers score", () => expect(budgetSignals({ ...rich, budgetUsd: 5000 }).budgetScore).toBeLessThan(budgetSignals(rich).budgetScore));
  it("Places enum price levels are understood", () => expect(budgetSignals({ ...rich, priceRange: "PRICE_LEVEL_EXPENSIVE" }).signals[0].points).toBeGreaterThan(0));
});
