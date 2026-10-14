import { safeGet } from "../common/util/safe-http";
import { isAllowed, parseRobots, RobotsRules } from "./robots";

const MAX_ORIGINS_CACHED = 500;

/**
 * Fetches pages respecting robots.txt and a per-host rate limit (SSRF-safe via safeGet).
 * Requests to the same host are serialized so concurrent pipeline jobs cannot bypass the delay.
 */
export interface FetchedPage {
  html: string;
  status: number;
  truncated: boolean;
}

export class PoliteFetcher {
  private robots = new Map<string, RobotsRules>();
  private hostQueue = new Map<string, Promise<unknown>>();

  constructor(private minDelayMs = 1000, private timeoutMs = 8000) {}

  private async rulesFor(origin: string): Promise<RobotsRules> {
    const cached = this.robots.get(origin);
    if (cached) return cached;
    let rules: RobotsRules = { disallow: [], allow: [], crawlDelaySec: null };
    try {
      const res = await safeGet(`${origin}/robots.txt`, { timeoutMs: this.timeoutMs, maxBytes: 100_000 });
      if (res.status >= 200 && res.status < 300) rules = parseRobots(res.body);
    } catch {
      // Unreachable robots.txt = no rules; the page fetch itself surfaces real network errors.
    }
    if (this.robots.size >= MAX_ORIGINS_CACHED) this.robots.delete(this.robots.keys().next().value as string);
    this.robots.set(origin, rules);
    return rules;
  }

  /** Runs `task` after every earlier task for the same host, spaced by `delayMs`. */
  private serialize<T>(host: string, delayMs: number, task: () => Promise<T>): Promise<T> {
    const prev = this.hostQueue.get(host) ?? Promise.resolve();
    const run = prev.catch(() => undefined).then(async () => {
      await new Promise((r) => setTimeout(r, delayMs));
      return task();
    });
    this.hostQueue.set(host, run);
    run.finally(() => {
      if (this.hostQueue.get(host) === run) this.hostQueue.delete(host);
    }).catch(() => undefined);
    return run;
  }

  /** Returns HTML, or null when robots.txt disallows the path. Throws on network errors. */
  async fetchHtml(url: string): Promise<FetchedPage | null> {
    const u = new URL(url);
    const rules = await this.rulesFor(u.origin);
    if (!isAllowed(rules, u.pathname + u.search)) return null;
    const delay = Math.max(this.minDelayMs, (rules.crawlDelaySec ?? 0) * 1000);
    const res = await this.serialize(u.host, delay, () => safeGet(url, { timeoutMs: this.timeoutMs, maxBytes: 500_000, allowPartial: true }));
    const textual = res.contentType === "" || /html|text/i.test(res.contentType);
    return { html: textual ? res.body : "", status: res.status, truncated: Boolean(res.truncated) };
  }
}
