import { Injectable } from "@nestjs/common";
import { GoogleMapsScraperService } from "../../scraper/google-maps.scraper";
import { DiscoveredPlace, DiscoveryDriver, DiscoveryQuery } from "../discovery.types";

/** Legacy in-process Playwright scraper inherited from Prospex (last-resort fallback). */
@Injectable()
export class PlaywrightDriver implements DiscoveryDriver {
  readonly name = "playwright";
  constructor(private scraper: GoogleMapsScraperService) {}

  async discover(q: DiscoveryQuery): Promise<DiscoveredPlace[]> {
    const raw = await this.scraper.scrape([q.niche, q.city, q.country].filter(Boolean).join(" "), q.maxResults);
    return raw.map((b) => ({
      name: b.name,
      address: b.address || null,
      phone: b.phone || null,
      website: b.website || null,
      rating: b.rating && !Number.isNaN(parseFloat(b.rating)) ? parseFloat(b.rating) : null,
      reviewCount: b.reviewCount,
      category: null,
      lat: b.lat,
      lng: b.lng,
      mapsUrl: b.referenceLink || null,
      priceRange: null,
      claimed: null,
      photoCount: null,
      emails: [],
      source: "playwright",
    }));
  }
}
