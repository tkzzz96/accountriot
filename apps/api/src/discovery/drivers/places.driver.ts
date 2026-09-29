import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveredPlace, DiscoveryDriver, DiscoveryQuery } from "../discovery.types";

const FIELD_MASK = [
  "places.displayName",
  "places.formattedAddress",
  "places.internationalPhoneNumber",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.primaryTypeDisplayName",
  "places.location",
  "places.googleMapsUri",
  "places.priceLevel",
  "places.photos",
].join(",");

interface PlacesApiPlace {
  displayName?: { text?: string };
  formattedAddress?: string;
  internationalPhoneNumber?: string;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
  priceLevel?: string;
  photos?: unknown[];
}

/**
 * Official Google Places API (New) driver — the ToS-safe alternative to scraping.
 * Enabled only when PLACES_API_KEY is set.
 */
@Injectable()
export class PlacesApiDriver implements DiscoveryDriver {
  readonly name = "places";
  private readonly logger = new Logger(PlacesApiDriver.name);

  constructor(private config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>("PLACES_API_KEY"));
  }

  async discover(q: DiscoveryQuery): Promise<DiscoveredPlace[]> {
    const key = this.config.get<string>("PLACES_API_KEY");
    if (!key) throw new Error("PLACES_API_KEY is not set");
    const out: DiscoveredPlace[] = [];
    let pageToken: string | undefined;
    const textQuery = [q.niche, q.city, q.country].filter(Boolean).join(" ");

    while (out.length < q.maxResults) {
      const body: Record<string, unknown> = {
        textQuery,
        languageCode: q.language.toLowerCase().startsWith("pt") ? "pt-BR" : "en",
        pageSize: Math.min(20, q.maxResults - out.length),
      };
      if (pageToken) body.pageToken = pageToken;
      if (q.lat != null && q.lng != null) {
        body.locationBias = {
          circle: { center: { latitude: q.lat, longitude: q.lng }, radius: Math.min(50000, (q.radiusKm ?? 10) * 1000) },
        };
      }
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK + ",nextPageToken" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Places API HTTP ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { places?: PlacesApiPlace[]; nextPageToken?: string };
      for (const p of json.places ?? []) {
        out.push({
          name: p.displayName?.text ?? "",
          address: p.formattedAddress ?? null,
          phone: p.internationalPhoneNumber ?? p.nationalPhoneNumber ?? null,
          website: p.websiteUri ?? null,
          rating: p.rating ?? null,
          reviewCount: p.userRatingCount ?? null,
          category: p.primaryTypeDisplayName?.text ?? null,
          lat: p.location?.latitude ?? null,
          lng: p.location?.longitude ?? null,
          mapsUrl: p.googleMapsUri ?? null,
          priceRange: p.priceLevel ?? null,
          claimed: null,
          photoCount: p.photos?.length ?? null,
          emails: [],
          source: "places",
        });
      }
      pageToken = json.nextPageToken;
      if (!pageToken) break;
    }
    this.logger.log(`Places API returned ${out.length} places for "${textQuery}"`);
    return out.filter((p) => p.name).slice(0, q.maxResults);
  }
}
