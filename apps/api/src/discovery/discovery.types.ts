export interface DiscoveryQuery {
  niche: string;
  country: string;
  city: string;
  radiusKm?: number;
  lat?: number;
  lng?: number;
  maxResults: number;
  language: string; // "pt-BR" | "en"
}

export interface DiscoveredPlace {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  lat: number | null;
  lng: number | null;
  mapsUrl: string | null;
  priceRange: string | null;
  claimed: boolean | null;
  photoCount: number | null;
  emails: string[];
  source: string;
}

export interface DiscoveryDriver {
  readonly name: string;
  discover(query: DiscoveryQuery): Promise<DiscoveredPlace[]>;
}

export const DISCOVERY_DRIVERS = Symbol("DISCOVERY_DRIVERS");
