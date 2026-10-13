import { SOCIAL_DOMAINS } from "./rules/social-domains";
import { FREE_BUILDER_DOMAINS } from "./rules/free-builders";

export type SiteStatusValue = "NONE" | "SOCIAL_ONLY" | "FREE_BUILDER" | "DEAD" | "HAS_SITE" | "UNKNOWN";

/** Stable machine-readable reason; the UI maps it to localized text (`reason` stays English for API consumers). */
export type EvidenceCode =
  | "NO_WEBSITE" | "SOCIAL_PROFILE" | "FREE_BUILDER" | "UNPARSEABLE_URL" | "DNS_FAILURE" | "NO_RESPONSE"
  | "PARKED_DOMAIN" | "HTTP_OK" | "BOT_BLOCKED" | "HTTP_ERROR" | "HTTP_AMBIGUOUS" | "REDIRECT_SOCIAL"
  | "REDIRECT_FREE_BUILDER" | "OFFLINE" | "NON_PUBLIC_ADDRESS";

export interface SiteEvidence {
  url: string | null;
  httpStatus: number | null;
  dnsOk: boolean | null;
  reason: string;
  code: EvidenceCode;
}

export interface SiteClassification {
  status: SiteStatusValue;
  evidence: SiteEvidence;
}

export interface ProbeResult {
  dnsOk: boolean;
  /** true when we could not verify network connectivity at all (avoid marking everything DEAD) */
  offline?: boolean;
  /** The host resolves to a private/loopback/link-local address (never fetched). */
  blocked?: boolean;
  httpStatus: number | null;
  finalUrl?: string | null;
  bodySnippet?: string | null;
  error?: string | null;
}

export type Probe = (url: string) => Promise<ProbeResult>;

const PARKED_MARKERS = [
  "this domain is for sale",
  "domain is for sale",
  "buy this domain",
  "domain parking",
  "parked domain",
  "parked free",
  "sedoparking",
  "this domain may be for sale",
  "domínio à venda",
  "dominio a venda",
  "este domínio está à venda",
  "registrar.br",
  "account suspended",
  "conta suspensa",
  "default web site page",
  "coming soon - godaddy",
  "hugedomains",
  "afternic",
];

/** Extract the hostname from a raw string; returns null when it cannot be a valid URL. */
export function normalizeUrl(raw: string | null | undefined): { url: string; host: string } | null {
  if (!raw) return null;
  let value = raw.trim();
  if (!value) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(value)) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) value = `https://${value}`;
  try {
    const u = new URL(value);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host || !host.includes(".") || /\s/.test(host)) return null;
    return { url: u.toString(), host };
  } catch {
    return null;
  }
}

function matchesDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

/** Deterministic rules that need no network. Returns null when a probe is required. */
export function classifyStatic(raw: string | null | undefined): SiteClassification | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) {
    return { status: "NONE", evidence: { url: null, httpStatus: null, dnsOk: null, reason: "No website listed on the profile", code: "NO_WEBSITE" } };
  }
  const parsed = normalizeUrl(trimmed);
  if (!parsed) {
    return { status: "UNKNOWN", evidence: { url: trimmed, httpStatus: null, dnsOk: null, reason: "Website value is not a valid URL", code: "UNPARSEABLE_URL" } };
  }
  const social = SOCIAL_DOMAINS.find((d) => matchesDomain(parsed.host, d));
  if (social) {
    return { status: "SOCIAL_ONLY", evidence: { url: parsed.url, httpStatus: null, dnsOk: null, reason: `Listed website is a social/link-hub profile (${social})`, code: "SOCIAL_PROFILE" } };
  }
  const builder = FREE_BUILDER_DOMAINS.find((d) => matchesDomain(parsed.host, d));
  if (builder) {
    return { status: "FREE_BUILDER", evidence: { url: parsed.url, httpStatus: null, dnsOk: null, reason: `Free builder / marketplace subdomain (${builder})`, code: "FREE_BUILDER" } };
  }
  return null;
}

export function looksParked(body: string | null | undefined): boolean {
  if (!body) return false;
  const lower = body.toLowerCase();
  return PARKED_MARKERS.some((m) => lower.includes(m));
}

/** Classify the outcome of a network probe (pure — easy to unit test). */
export function classifyProbe(url: string, probe: ProbeResult): SiteClassification {
  if (probe.offline) {
    return { status: "UNKNOWN", evidence: { url, httpStatus: null, dnsOk: null, reason: "No network connectivity during probe; not classified", code: "OFFLINE" } };
  }
  if (probe.blocked) {
    return { status: "UNKNOWN", evidence: { url, httpStatus: null, dnsOk: true, reason: "Host resolves to a non-public address; not contacted", code: "NON_PUBLIC_ADDRESS" } };
  }
  if (!probe.dnsOk) {
    return { status: "DEAD", evidence: { url, httpStatus: null, dnsOk: false, reason: "Domain does not resolve (DNS failure)", code: "DNS_FAILURE" } };
  }
  if (probe.finalUrl && probe.finalUrl !== url) {
    const redirected = classifyStatic(probe.finalUrl);
    if (redirected && redirected.status !== "NONE" && redirected.status !== "UNKNOWN") {
      return {
        status: redirected.status,
        evidence: {
          url,
          httpStatus: probe.httpStatus,
          dnsOk: true,
          reason: `Redirects to ${redirected.evidence.reason.toLowerCase()}`,
          code: redirected.status === "SOCIAL_ONLY" ? "REDIRECT_SOCIAL" : "REDIRECT_FREE_BUILDER",
        },
      };
    }
  }
  if (probe.httpStatus == null) {
    return { status: "DEAD", evidence: { url, httpStatus: null, dnsOk: true, reason: `No HTTP response (${probe.error ?? "timeout"})`, code: "NO_RESPONSE" } };
  }
  if (looksParked(probe.bodySnippet)) {
    return { status: "DEAD", evidence: { url, httpStatus: probe.httpStatus, dnsOk: true, reason: "Parked / for-sale / suspended domain page", code: "PARKED_DOMAIN" } };
  }
  const s = probe.httpStatus;
  if (s >= 200 && s < 400) {
    return { status: "HAS_SITE", evidence: { url, httpStatus: s, dnsOk: true, reason: "Site responds normally", code: "HTTP_OK" } };
  }
  if (s === 401 || s === 403 || s === 429) {
    return { status: "HAS_SITE", evidence: { url, httpStatus: s, dnsOk: true, reason: "Site is alive but blocks automated requests", code: "BOT_BLOCKED" } };
  }
  if (s === 404 || s === 410 || s >= 500) {
    return { status: "DEAD", evidence: { url, httpStatus: s, dnsOk: true, reason: `Persistent HTTP ${s} on the listed URL`, code: "HTTP_ERROR" } };
  }
  return { status: "UNKNOWN", evidence: { url, httpStatus: s, dnsOk: true, reason: `Ambiguous HTTP ${s}`, code: "HTTP_AMBIGUOUS" } };
}

export async function classifySite(raw: string | null | undefined, probe: Probe): Promise<SiteClassification> {
  const fixed = classifyStatic(raw);
  if (fixed) return fixed;
  const parsed = normalizeUrl(raw)!;
  const result = await probe(parsed.url);
  return classifyProbe(parsed.url, result);
}
