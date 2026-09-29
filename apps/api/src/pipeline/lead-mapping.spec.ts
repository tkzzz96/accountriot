import { describe, it, expect } from "vitest";
import { dedupePlaces, placeToLeadData, shouldKeep } from "./lead-mapping";
import { DiscoveredPlace } from "../discovery/discovery.types";

const place = (o: Partial<DiscoveredPlace> = {}): DiscoveredPlace => ({
  name: "Padaria Zé", address: "Rua A, 1", phone: "(11) 99999-8888", website: null, rating: 4.5, reviewCount: 30,
  category: "Bakery", lat: 1, lng: 2, mapsUrl: "https://maps/x", priceRange: null, claimed: null, photoCount: 3, emails: [], source: "gosom", ...o,
});

describe("shouldKeep", () => {
  it("requireNoSite drops HAS_SITE only", () => {
    expect(shouldKeep("HAS_SITE", true)).toBe(false);
    for (const s of ["NONE", "SOCIAL_ONLY", "FREE_BUILDER", "DEAD", "UNKNOWN"] as const) expect(shouldKeep(s, true)).toBe(true);
  });
  it("without requireNoSite keeps everything", () => expect(shouldKeep("HAS_SITE", false)).toBe(true));
});

describe("dedupePlaces", () => {
  it("dedupes by phone across formats", () =>
    expect(dedupePlaces([place(), place({ name: "Outra", phone: "+55 11 99999-8888" })], "55")).toHaveLength(1));
  it("dedupes by name+address when no phone", () =>
    expect(dedupePlaces([place({ phone: null }), place({ phone: null, name: "padaria ze", address: "rua a 1" })], "55")).toHaveLength(1));
  it("keeps distinct places", () =>
    expect(dedupePlaces([place(), place({ name: "B", phone: "11 3333-4444" })], "55")).toHaveLength(2));
});

describe("placeToLeadData", () => {
  const site = { status: "NONE" as const, evidence: { url: null, httpStatus: null, dnsOk: null, reason: "x" } };
  it("marks contact source, business not owner", () => {
    const d = placeToLeadData(place(), site, "55");
    expect(d.contactSource).toBe("gosom:maps_profile");
    expect(d.ownerContactType).toBe("BUSINESS");
    expect(d.phoneNormalized).toBe("+5511999998888");
    expect(d.siteEvidence).toBeDefined();
  });
  it("no phone -> no contactSource", () => expect(placeToLeadData(place({ phone: null }), site, "55").contactSource).toBeNull());
});
