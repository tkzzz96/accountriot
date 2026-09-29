import { isAllowed, parseRobots, RobotsRules } from "./robots";

const UA = "Mozilla/5.0 (compatible; ProspectorBot/1.0)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetches pages respecting robots.txt and a per-host rate limit. */
export class PoliteFetcher {
  private robots = new Map<string, RobotsRules>();
  private lastHit = new Map<string, number>();

  constructor(private minDelayMs = 1000, private timeoutMs = 8000) {}

  private async rulesFor(origin: string): Promise<RobotsRules> {
    const cached = this.robots.get(origin);
    if (cached) return cached;
    let rules: RobotsRules = { disallow: [], allow: [], crawlDelaySec: null };
    try {
      const res = await this.get(`${origin}/robots.txt`);
      if (res.ok) rules = parseRobots(await res.text());
    } catch {
      // Unreachable robots.txt: treated as "no rules"; the page fetch itself will surface real network errors.
    }
    this.robots.set(origin, rules);
    return rules;
  }

  private get(url: string): Promise<Response> {
    return fetch(url, { redirect: "follow", signal: AbortSignal.timeout(this.timeoutMs), headers: { "User-Agent": UA, Accept: "text/html,*/*" } });
  }

  /** Returns HTML, or null when robots.txt disallows the path. Throws on network errors. */
  async fetchHtml(url: string): Promise<{ html: string; status: number } | null> {
    const u = new URL(url);
    const rules = await this.rulesFor(u.origin);
    if (!isAllowed(rules, u.pathname + u.search)) return null;
    const delay = Math.max(this.minDelayMs, (rules.crawlDelaySec ?? 0) * 1000);
    const wait = (this.lastHit.get(u.host) ?? 0) + delay - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastHit.set(u.host, Date.now());
    const res = await this.get(url);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html") && !ct.includes("text")) return { html: "", status: res.status };
    return { html: (await res.text()).slice(0, 500_000), status: res.status };
  }
}
