import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DiscoveredPlace, DiscoveryDriver, DiscoveryQuery } from "../discovery.types";
import { parseGosomCsv } from "./gosom.parser";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Calls the gosom/google-maps-scraper sidecar (Docker) via its REST API. */
@Injectable()
export class GosomDriver implements DiscoveryDriver {
  readonly name = "gosom";
  private readonly logger = new Logger(GosomDriver.name);

  constructor(private config: ConfigService) {}

  private get baseUrl(): string {
    return this.config.get<string>("GOSOM_URL", "http://localhost:8080").replace(/\/$/, "");
  }

  async discover(q: DiscoveryQuery): Promise<DiscoveredPlace[]> {
    const keyword = [q.niche, q.city, q.country].filter(Boolean).join(" ");
    const radiusM = Math.round((q.radiusKm ?? 10) * 1000);
    const body: Record<string, unknown> = {
      Name: `prospector-${Date.now()}`,
      keywords: [keyword],
      lang: q.language.toLowerCase().startsWith("pt") ? "pt" : "en",
      zoom: 15,
      depth: Math.max(1, Math.ceil(q.maxResults / 20)),
      fast_mode: false,
      email: false,
      radius: radiusM,
      max_time: 5 * 60 * 1e9, // Go time.Duration = nanoseconds
    };
    if (q.lat != null && q.lng != null) {
      body.lat = String(q.lat);
      body.lon = String(q.lng);
    }

    const created = await fetch(`${this.baseUrl}/api/v1/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!created.ok) throw new Error(`gosom job creation failed: HTTP ${created.status} ${await created.text()}`);
    const { id } = (await created.json()) as { id: string };
    this.logger.log(`gosom job ${id} started for "${keyword}"`);

    const deadline = Date.now() + 10 * 60 * 1000;
    for (;;) {
      if (Date.now() > deadline) throw new Error(`gosom job ${id} timed out`);
      await sleep(4000);
      const res = await fetch(`${this.baseUrl}/api/v1/jobs/${id}`);
      if (!res.ok) throw new Error(`gosom status failed: HTTP ${res.status}`);
      const job = (await res.json()) as Record<string, string>;
      const status = String(job.Status ?? job.status ?? "").toLowerCase();
      if (status === "ok") break;
      if (status === "failed") throw new Error(`gosom job ${id} failed`);
    }

    const csv = await fetch(`${this.baseUrl}/api/v1/jobs/${id}/download`);
    if (!csv.ok) throw new Error(`gosom download failed: HTTP ${csv.status}`);
    return parseGosomCsv(await csv.text()).slice(0, q.maxResults);
  }
}
