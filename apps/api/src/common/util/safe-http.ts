// SSRF-safe HTTP GET for URLs that come from third-party data (e.g. the `website` field of a Maps listing).
// - only http/https on common web ports
// - every resolved address (and every redirect hop) must be a public IP; the check happens inside the
//   socket's DNS lookup, so DNS-rebinding between "check" and "connect" is not possible
// - bounded redirects, total deadline and response size
import * as dns from "dns";
import * as http from "http";
import * as https from "https";
import * as net from "net";

export class BlockedAddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedAddressError";
  }
}
export class DnsFailureError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "DnsFailureError";
  }
}

const V4_BLOCKS: Array<[string, number]> = [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16],
  ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
];

const v4ToInt = (ip: string): number => ip.split(".").reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;

function isPublicV4(ip: string): boolean {
  const n = v4ToInt(ip);
  return !V4_BLOCKS.some(([base, bits]) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) >>> 0 === (v4ToInt(base) & mask) >>> 0;
  });
}

/** Expands an IPv6 literal to 8 numeric groups (handles "::" and an embedded dotted IPv4). */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0];
  const dotted = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const n = v4ToInt(dotted[1]);
    s = s.replace(dotted[1], `${((n >>> 16) & 0xffff).toString(16)}:${(n & 0xffff).toString(16)}`);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function isPublicV6(ip: string): boolean {
  const g = expandV6(ip);
  if (!g) return false;
  if (g.every((x) => x === 0)) return false; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return false; // ::1
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) {
    // IPv4-mapped (::ffff:a.b.c.d)
    return isPublicV4(`${g[6] >> 8}.${g[6] & 255}.${g[7] >> 8}.${g[7] & 255}`);
  }
  if ((g[0] & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return false; // fe80::/10 link local
  if ((g[0] & 0xff00) === 0xff00) return false; // multicast
  if (g[0] === 0x2001 && g[1] === 0x0db8) return false; // documentation
  if (g[0] === 0x2002) return false; // 6to4 can embed private v4
  if (g[0] === 0x0064 && g[1] === 0xff9b) return false; // NAT64
  if (g[0] === 0 && g[1] === 0 && g[2] === 0 && g[3] === 0 && g[4] === 0xffff) return false;
  return true;
}

export function isPublicIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPublicV4(ip);
  if (kind === 6) return isPublicV6(ip);
  return false;
}

export interface SafeGetOptions {
  timeoutMs?: number; // total deadline across redirects
  maxBytes?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  allowedPorts?: number[];
  /** Tests only: skip the public-address check. Never wire this to user or config input. */
  allowPrivate?: boolean;
}

export interface SafeGetResult {
  status: number;
  finalUrl: string;
  body: string;
  contentType: string;
}

const DEFAULT_PORTS = [80, 443, 8080, 8443];

function guardedLookup(allowPrivate: boolean) {
  return (hostname: string, options: dns.LookupOptions, cb: (...args: unknown[]) => void) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
      if (err) return cb(err);
      const list = addrs as dns.LookupAddress[];
      const bad = list.find((a) => !allowPrivate && !isPublicIp(a.address));
      if (bad) return cb(new BlockedAddressError(`${hostname} resolves to a non-public address (${bad.address})`));
      if (options.all) return cb(null, list);
      return cb(null, list[0].address, list[0].family);
    });
  };
}

function once(url: URL, remainingMs: number, maxBytes: number, o: SafeGetOptions): Promise<SafeGetResult & { location?: string }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; ProspectorBot/1.0)", Accept: "text/html,*/*;q=0.5", ...(o.headers ?? {}) },
        lookup: guardedLookup(Boolean(o.allowPrivate)) as unknown as net.LookupFunction,
        timeout: remainingMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          res.resume();
          return resolve({ status, finalUrl: url.toString(), body: "", contentType: "", location });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > maxBytes) {
            chunks.push(c.subarray(0, c.length - (size - maxBytes)));
            res.destroy(); // stop downloading: response cap reached
            return;
          }
          chunks.push(c);
        });
        const finish = () => resolve({ status, finalUrl: url.toString(), body: Buffer.concat(chunks).toString("utf8"), contentType: String(res.headers["content-type"] ?? "") });
        res.on("end", finish);
        res.on("close", finish);
        res.on("error", finish);
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", (err: NodeJS.ErrnoException) => {
      if (err instanceof BlockedAddressError) return reject(err);
      if (err.code === "ENOTFOUND" || err.code === "ENODATA") return reject(new DnsFailureError(err.message, err.code));
      reject(err);
    });
    req.end();
  });
}

/** Validates one request target (run for the first URL and for every redirect hop). */
export function assertTargetAllowed(url: URL, o: SafeGetOptions = {}): void {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedAddressError(`Protocol not allowed: ${url.protocol}`);
  if (o.allowPrivate) return;
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (!(o.allowedPorts ?? DEFAULT_PORTS).includes(port)) throw new BlockedAddressError(`Port not allowed: ${port}`);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host) && !isPublicIp(host)) throw new BlockedAddressError(`Address not allowed: ${host}`);
}

export async function safeGet(rawUrl: string, o: SafeGetOptions = {}): Promise<SafeGetResult> {
  const deadline = Date.now() + (o.timeoutMs ?? 8000);
  const maxBytes = o.maxBytes ?? 500_000;
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= (o.maxRedirects ?? 5); hop++) {
    assertTargetAllowed(url, o);
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");
    const r = await once(url, remaining, maxBytes, o);
    if (r.location) {
      url = new URL(r.location, url);
      continue;
    }
    return { status: r.status, finalUrl: r.finalUrl, body: r.body, contentType: r.contentType };
  }
  throw new Error("too many redirects");
}
