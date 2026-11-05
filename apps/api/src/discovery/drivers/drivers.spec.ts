import * as http from "http";
import { AddressInfo } from "net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { GosomDriver } from "./gosom.driver";
import { PlacesApiDriver } from "./places.driver";
import { MockDriver } from "./mock.driver";
import type { DiscoveryQuery } from "../discovery.types";

const q: DiscoveryQuery = { niche: "padaria", country: "Brasil", city: "Santos", maxResults: 5, language: "pt-BR" };
const cfg = (env: Record<string, string>) => ({ get: (k: string, d?: string) => env[k] ?? d }) as unknown as ConfigService;

const CSV = `title,category,address,website,phone,review_count,review_rating,latitude,longitude
Padaria Sol,Bakery,"Rua 1",,"(13) 99999-0000",10,4.5,-23.9,-46.3
Padaria Lua,Bakery,"Rua 2",https://instagram.com/lua,,3,5,,`;

/** A fake gosom REST sidecar: job goes "pending" once, then "ok". */
function fakeGosom(opts: { failStatus?: boolean } = {}) {
  const log: string[] = [];
  let polls = 0;
  const server = http.createServer((req, res) => {
    log.push(`${req.method} ${req.url}`);
    if (req.method === "POST" && req.url === "/api/v1/jobs") {
      res.writeHead(201, { "content-type": "application/json" }).end(JSON.stringify({ id: "job1" }));
    } else if (req.method === "GET" && req.url === "/api/v1/jobs/job1") {
      polls++;
      const status = opts.failStatus ? "failed" : polls < 2 ? "pending" : "ok";
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ Status: status }));
    } else if (req.url === "/api/v1/jobs/job1/download") {
      res.writeHead(200).end(CSV);
    } else if (req.method === "DELETE") {
      res.writeHead(200).end("{}");
    } else {
      res.writeHead(404).end();
    }
  });
  return new Promise<{ url: string; log: string[]; close: () => Promise<void> }>((resolve) =>
    server.listen(0, "127.0.0.1", () =>
      resolve({ url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, log, close: () => new Promise((r) => server.close(() => r())) }),
    ),
  );
}

describe("GosomDriver (fake sidecar)", () => {
  it("creates a job, polls until ok, parses the CSV and deletes the job", async () => {
    const s = await fakeGosom();
    try {
      const places = await new GosomDriver(cfg({ GOSOM_URL: s.url, GOSOM_POLL_MS: "10" })).discover(q);
      expect(places.map((p) => p.name)).toEqual(["Padaria Sol", "Padaria Lua"]);
      expect(places[0].website).toBeNull();
      expect(s.log[0]).toBe("POST /api/v1/jobs");
      expect(s.log).toContain("DELETE /api/v1/jobs/job1");
    } finally {
      await s.close();
    }
  });

  it("surfaces a failed job and still cleans up", async () => {
    const s = await fakeGosom({ failStatus: true });
    try {
      await expect(new GosomDriver(cfg({ GOSOM_URL: s.url, GOSOM_POLL_MS: "10" })).discover(q)).rejects.toThrow(/failed/);
      expect(s.log).toContain("DELETE /api/v1/jobs/job1");
    } finally {
      await s.close();
    }
  });

  it("errors clearly when the sidecar is down", async () => {
    await expect(new GosomDriver(cfg({ GOSOM_URL: "http://127.0.0.1:1", GOSOM_POLL_MS: "10" })).discover(q)).rejects.toThrow();
  });
});

describe("PlacesApiDriver (stubbed fetch)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("refuses to run without a key", async () => {
    const d = new PlacesApiDriver(cfg({}));
    expect(d.enabled).toBe(false);
    await expect(d.discover(q)).rejects.toThrow(/PLACES_API_KEY/);
  });

  it("maps places, paginates and caps at maxResults; websiteUri absent stays null (no invented data)", async () => {
    const page = (n: number, token?: string) => ({
      places: Array.from({ length: n }, (_, i) => ({
        displayName: { text: `P${token ?? "1"}-${i}` }, formattedAddress: "addr", userRatingCount: 5, rating: 4,
        ...(i === 0 ? { websiteUri: "https://x.com" } : {}),
      })),
      ...(token ? {} : { nextPageToken: "t2" }),
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(page(3)), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(page(3, "2")), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const places = await new PlacesApiDriver(cfg({ PLACES_API_KEY: "k" })).discover({ ...q, maxResults: 5 });
    expect(places).toHaveLength(5);
    expect(places[0].website).toBe("https://x.com");
    expect(places[1].website).toBeNull();
    expect(fetchMock.mock.calls[0][1].headers["X-Goog-Api-Key"]).toBe("k");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).pageToken).toBe("t2");
  });

  it("propagates HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("denied", { status: 403 })));
    await expect(new PlacesApiDriver(cfg({ PLACES_API_KEY: "k" })).discover(q)).rejects.toThrow(/403/);
  });
});

describe("MockDriver", () => {
  it("is deterministic and respects maxResults", async () => {
    const a = await new MockDriver().discover({ ...q, maxResults: 7 });
    const b = await new MockDriver().discover({ ...q, maxResults: 7 });
    expect(a).toHaveLength(7);
    expect(a).toEqual(b);
    expect(new Set(a.map((p) => p.name)).size).toBe(7);
  });
});
