import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ReferenceProvider } from "./reference-provider";
import { RefItem } from "../selection";

/**
 * Pinterest is OUT of the critical path (see references/README.md).
 * Only enabled with PINTEREST_ACCESS_TOKEN (official API v5). No scraping, no image downloads.
 */
@Injectable()
export class PinterestProvider implements ReferenceProvider {
  readonly name = "pinterest";
  constructor(private config: ConfigService) {}

  get enabled(): boolean {
    return Boolean(this.config.get<string>("PINTEREST_ACCESS_TOKEN"));
  }

  async find(niche: string): Promise<RefItem[]> {
    if (!this.enabled) return [];
    const token = this.config.get<string>("PINTEREST_ACCESS_TOKEN");
    const res = await fetch(`https://api.pinterest.com/v5/search/pins?query=${encodeURIComponent(`${niche} website design`)}&page_size=10`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Pinterest API HTTP ${res.status}`);
    const json = (await res.json()) as { items?: Array<{ link?: string; title?: string; media?: { images?: Record<string, { url: string }> } }> };
    return (json.items ?? [])
      .filter((p) => p.link && p.media?.images)
      .map((p) => ({
        url: p.link!,
        thumbUrl: (p.media!.images!["400x300"] ?? Object.values(p.media!.images!)[0]).url, // hotlinked by URL, never stored
        source: "pinterest",
        niche,
        title: p.title || p.link!,
      }));
  }
}
