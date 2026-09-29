import { promises as dns } from "dns";
import { ProbeResult } from "./site-classifier";

const TIMEOUT_MS = 8000;
const UA = "Mozilla/5.0 (compatible; ProspectorBot/1.0)";

async function resolves(host: string): Promise<boolean> {
  try {
    await dns.lookup(host);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // ENOTFOUND / ENODATA = domain genuinely missing; anything else (EAI_AGAIN, timeouts) is transient.
    if (code === "ENOTFOUND" || code === "ENODATA") return false;
    throw err;
  }
}

async function fetchOnce(url: string): Promise<ProbeResult> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": UA } });
    const text = (await res.text()).slice(0, 4000);
    return { dnsOk: true, httpStatus: res.status, finalUrl: res.url, bodySnippet: text };
  } catch (err) {
    return { dnsOk: true, httpStatus: null, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timer);
  }
}

/** Real network probe: DNS + one HTTP GET with a single retry on failure. */
export async function httpProbe(url: string): Promise<ProbeResult> {
  const host = new URL(url).hostname;
  try {
    if (!(await resolves(host))) {
      // Confirm we are online before declaring the domain dead.
      try {
        await resolves("example.com");
      } catch {
        return { dnsOk: false, offline: true, httpStatus: null };
      }
      return { dnsOk: false, httpStatus: null };
    }
  } catch {
    return { dnsOk: false, offline: true, httpStatus: null, error: "transient DNS error" };
  }
  const first = await fetchOnce(url);
  if (first.httpStatus != null && first.httpStatus < 500) return first;
  return fetchOnce(url);
}
