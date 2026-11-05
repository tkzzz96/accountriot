import { describe, it, expect } from "vitest";
import { ProspectorClient, configFromEnv } from "./client";
import { createCampaign, listLeads, summarizeLead } from "./tools";

function fakeFetch(routes: Record<string, (body: unknown) => unknown>, log: string[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const path = new URL(url).pathname.replace(/^\/api/, "");
    log.push(`${init?.method ?? "GET"} ${path}${new URL(url).search}`);
    const h = routes[`${init?.method ?? "GET"} ${path}`];
    if (!h) return new Response("nope", { status: 404 });
    return new Response(JSON.stringify(h(init?.body ? JSON.parse(init.body as string) : undefined)), { status: 200 });
  }) as unknown as typeof fetch;
}
const cfg = { baseUrl: "http://x/api", email: "a@b.c", password: "p" };

describe("mcp tools", () => {
  it("createCampaign wraps filter and starts the campaign", async () => {
    const log: string[] = [];
    let sent: any;
    const c = new ProspectorClient(cfg, fakeFetch({
      "POST /auth/login": () => ({ accessToken: "t" }),
      "POST /campaigns": (b) => { sent = b; return { id: "c1" }; },
      "POST /scraper/campaigns/c1/start": () => ({}),
    }, log));
    const r = await createCampaign(c, { name: "N", niche: "barbearia", city: "Curitiba", country: "Brasil", language: "pt-BR", channel: "whatsapp", requireNoSite: true, maxResults: 50 });
    expect(r.campaignId).toBe("c1");
    expect(sent.filter.niche).toBe("barbearia");
    expect(sent.filter.name).toBeUndefined();
    expect(log).toContain("POST /scraper/campaigns/c1/start");
  });
  it("listLeads summarizes and builds the query", async () => {
    const log: string[] = [];
    const c = new ProspectorClient(cfg, fakeFetch({
      "POST /auth/login": () => ({ accessToken: "t" }),
      "GET /leads": () => ({ total: 1, data: [{ id: "l1", name: "X", score: 90, priority: "HIGH", siteStatus: "NONE", pipelineStage: "READY", whatsapp: "+5541", aiAnalysis: { secret: 1 } }] }),
    }, log));
    const r = await listLeads(c, { campaignId: "c1", priority: "HIGH", limit: 5 });
    expect(r.leads[0]).toEqual({ id: "l1", name: "X", score: 90, priority: "HIGH", siteStatus: "NONE", stage: "READY", contact: "+5541", budgetScore: undefined });
    expect(log.some((l) => l.includes("campaignId=c1") && l.includes("priority=HIGH") && l.includes("limit=5"))).toBe(true);
  });
  it("summarizeLead prefers whatsapp then phone then email", () => {
    const base = { id: "1", name: "n", score: 1, priority: "LOW", siteStatus: "NONE", pipelineStage: "READY" };
    expect(summarizeLead({ ...base, phone: "p", email: "e" }).contact).toBe("p");
    expect(summarizeLead({ ...base, email: "e" }).contact).toBe("e");
    expect(summarizeLead(base).contact).toBeNull();
  });
  it("re-logins once on 401", async () => {
    let calls = 0;
    const f = (async (url: string) => {
      const p = new URL(url).pathname;
      if (p.endsWith("/auth/login")) return new Response(JSON.stringify({ accessToken: `t${++calls}` }), { status: 200 });
      return new Response(calls < 2 ? "no" : JSON.stringify({ ok: true }), { status: calls < 2 ? 401 : 200 });
    }) as unknown as typeof fetch;
    expect(await new ProspectorClient(cfg, f).request("GET", "/x")).toEqual({ ok: true });
  });
});

describe("auth modes", () => {
  it("configFromEnv prefers PROSPECTOR_API_KEY and validates its prefix", () => {
    expect(configFromEnv({ PROSPECTOR_API_KEY: "px_abc", PROSPECTOR_EMAIL: "a@b.c", PROSPECTOR_PASSWORD: "p" })).toEqual({ baseUrl: "http://localhost:3001/api", apiKey: "px_abc" });
    expect(() => configFromEnv({ PROSPECTOR_API_KEY: "sk-nope" })).toThrow(/px_/);
    expect(configFromEnv({ PROSPECTOR_EMAIL: "a@b.c", PROSPECTOR_PASSWORD: "p", PROSPECTOR_API_URL: "http://h/api/" })).toMatchObject({ baseUrl: "http://h/api", email: "a@b.c" });
    expect(() => configFromEnv({})).toThrow(/PROSPECTOR_API_KEY/);
  });

  it("with an API key it sends 'ApiKey …', never logs in, and does not retry on 401", async () => {
    const seen: Array<{ path: string; auth: string | null }> = [];
    const f = (async (url: string, init?: RequestInit) => {
      seen.push({ path: new URL(url).pathname, auth: new Headers(init?.headers).get("authorization") });
      return new Response("denied", { status: 401 });
    }) as unknown as typeof fetch;
    const c = new ProspectorClient({ baseUrl: "http://x/api", apiKey: "px_k" }, f);
    await expect(c.request("GET", "/leads")).rejects.toThrow(/401/);
    expect(seen).toEqual([{ path: "/api/leads", auth: "ApiKey px_k" }]);
  });
});
