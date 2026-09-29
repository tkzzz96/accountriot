import { Injectable } from "@nestjs/common";
import { DiscoveredPlace, DiscoveryDriver, DiscoveryQuery } from "../discovery.types";

/** Deterministic fake data for e2e tests and offline demos (DISCOVERY_DRIVER=mock). */
@Injectable()
export class MockDriver implements DiscoveryDriver {
  readonly name = "mock";

  async discover(q: DiscoveryQuery): Promise<DiscoveredPlace[]> {
    const sites: Array<string | null> = [
      null, "https://instagram.com/mock", null, "https://mock.wixsite.com/home", null,
      "https://linktr.ee/mock", "http://this-domain-does-not-exist-prospector.invalid", null, "https://facebook.com/mock", null,
    ];
    return Array.from({ length: Math.min(q.maxResults, 100) }, (_, i) => ({
      name: `${q.niche} ${["Alfa", "Beta", "Gama", "Delta", "Ômega"][i % 5]} ${i + 1}`,
      address: `Rua ${i + 1}, ${q.city}, ${q.country}`,
      phone: `+55 41 9${String(80000000 + i * 1111)}`,
      website: sites[i % sites.length],
      rating: 3.6 + (i % 5) * 0.3,
      reviewCount: 8 + i * 13,
      category: q.niche,
      lat: -25.4 + i * 0.001,
      lng: -49.27 + i * 0.001,
      mapsUrl: `https://maps.example/mock/${i + 1}`,
      priceRange: i % 3 === 0 ? "$$" : null,
      claimed: i % 2 === 0,
      photoCount: 3 + i,
      emails: i % 4 === 0 ? [`contato${i}@example.com`] : [],
      source: "mock",
    }));
  }
}
