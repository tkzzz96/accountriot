import { parse } from "csv-parse/sync";
import { DiscoveredPlace } from "../discovery.types";

function num(v: string | undefined): number | null {
  if (v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function safeJson<T>(v: string | undefined, fallback: T): T {
  if (!v) return fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Parse the CSV that gosom/google-maps-scraper (MIT) exposes at /api/v1/jobs/{id}/download. */
export function parseGosomCsv(csv: string): DiscoveredPlace[] {
  const rows: Record<string, string>[] = parse(csv, { columns: true, skip_empty_lines: true, relax_column_count: true });
  return rows
    .filter((r) => r.title)
    .map((r) => {
      const images = safeJson<unknown[]>(r.images, []);
      const owner = safeJson<{ id?: string } | null>(r.owner, null);
      const emails = (r.emails ?? "")
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => e.includes("@"));
      return {
        name: r.title,
        address: r.address || null,
        phone: r.phone || null,
        website: r.website || null,
        rating: num(r.review_rating),
        reviewCount: num(r.review_count),
        category: r.category || null,
        lat: num(r.latitude),
        lng: num(r.longitude),
        mapsUrl: r.link || null,
        priceRange: r.price_range || null,
        // gosom exposes an owner block only for claimed profiles.
        claimed: owner ? Boolean(owner.id) : null,
        photoCount: Array.isArray(images) ? images.length : null,
        emails,
        source: "gosom",
      } satisfies DiscoveredPlace;
    });
}
