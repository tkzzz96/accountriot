import { DiscoveredPlace } from "../discovery/discovery.types";
import { SiteClassification, SiteStatusValue } from "../site-check/site-classifier";
import { buildDedupeKey, normalizePhone } from "../common/util/normalize";

/** With requireNoSite, drop leads that already have a working site. UNKNOWN is kept for review. */
export function shouldKeep(status: SiteStatusValue, requireNoSite: boolean): boolean {
  if (!requireNoSite) return true;
  return status !== "HAS_SITE";
}

export function dedupePlaces(places: DiscoveredPlace[], callingCode: string): DiscoveredPlace[] {
  const seen = new Set<string>();
  const out: DiscoveredPlace[] = [];
  for (const p of places) {
    const key = buildDedupeKey(p, callingCode);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

export function placeToLeadData(place: DiscoveredPlace, site: SiteClassification, callingCode: string) {
  const phoneNormalized = normalizePhone(place.phone, callingCode);
  return {
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    phone: place.phone,
    phoneNormalized,
    // Only a phone from the public Maps profile: business line, never presumed to be the owner.
    contactSource: place.phone ? `${place.source}:maps_profile` : null,
    // A phone published on the Maps profile is a BUSINESS contact; OWNER is never inferred.
    ownerContactType: (place.phone ? "BUSINESS" : "UNKNOWN") as "BUSINESS" | "UNKNOWN",
    email: place.emails[0] ?? null,
    website: place.website,
    hasWebsite: site.status === "HAS_SITE",
    rating: place.rating != null ? String(place.rating) : null,
    reviewCount: place.reviewCount,
    category: place.category,
    source: place.source,
    referenceUrl: place.mapsUrl,
    siteStatus: site.status,
    siteEvidence: site.evidence as unknown as object,
    dedupeKey: buildDedupeKey(place, callingCode),
    pipelineStage: "CLASSIFIED" as const,
    // Raw Maps signals kept for scoring/budget stages (Phase 2)
    aiAnalysis: {
      signals: {
        priceRange: place.priceRange,
        claimed: place.claimed,
        photoCount: place.photoCount,
        emails: place.emails,
      },
    } as object,
  };
}
