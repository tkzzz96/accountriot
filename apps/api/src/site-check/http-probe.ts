import { promises as dns } from "dns";
import { BlockedAddressError, DnsFailureError, safeGet } from "../common/util/safe-http";
import { ProbeResult } from "./site-classifier";

async function connectivityOk(): Promise<boolean> {
  try {
    await dns.lookup("example.com");
    return true;
  } catch {
    return false;
  }
}

async function attempt(url: string): Promise<ProbeResult> {
  try {
    const r = await safeGet(url, { timeoutMs: 8000, maxBytes: 4000 });
    return { dnsOk: true, httpStatus: r.status, finalUrl: r.finalUrl, bodySnippet: r.body };
  } catch (err) {
    if (err instanceof BlockedAddressError) return { dnsOk: true, blocked: true, httpStatus: null, error: err.message };
    if (err instanceof DnsFailureError) {
      // Only an authoritative "no such domain" can mean DEAD — and only when general DNS works.
      // Resolver hiccups (EAI_AGAIN, timeouts, SERVFAIL) must never turn a live site into a false "sem site".
      if (!err.authoritative || !(await connectivityOk())) return { dnsOk: false, offline: true, httpStatus: null, error: err.message };
      return { dnsOk: false, httpStatus: null, error: err.message };
    }
    return { dnsOk: true, httpStatus: null, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Real network probe (SSRF-safe): DNS + HTTP GET, one retry on transport errors / 5xx. */
export async function httpProbe(url: string): Promise<ProbeResult> {
  const first = await attempt(url);
  if (first.blocked || first.offline || !first.dnsOk) return first;
  if (first.httpStatus != null && first.httpStatus < 500) return first;
  return attempt(url);
}
