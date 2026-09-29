import { SOCIAL_DOMAINS } from "./rules/social-domains";
import { FREE_BUILDER_DOMAINS } from "./rules/free-builders";

export type SiteStatusValue = "NONE" | "SOCIAL_ONLY" | "FREE_BUILDER" | "DEAD" | "HAS_SITE" | "UNKNOWN";

export interface SiteEvidence {
  url: string | null;
  httpStatus: number | null;
  dnsOk: boolean | null;
  reason: string;
}

export interface SiteClassification {
  status: SiteStatusValue;
  evidence: SiteEvidence;
}

export interface ProbeResult {
  dnsOk: boolean;
  /** true when we could not verify network connectivity at all (avoid marking everything DEAD) */
  offline?: boolean;
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
    return { status: "NONE", evidence: { url: null, httpStatus: null, dnsOk: null, reason: "No website listed on the profile" } };
  }
  const parsed = normalizeUrl(trimmed);
  if (!parsed) {
    return { status: "UNKNOWN", evidence: { url: trimmed, httpStatus: null, dnsOk: null, reason: "Website value is not a valid URL" } };
  }
  const social = SOCIAL_DOMAINS.find((d) => matchesDomain(parsed.host, d));
  if (social) {
    return { status: "SOCIAL_ONLY", evidence: { url: parsed.url, httpStatus: null, dnsOk: null, reason: `Listed website is a social/link-hub profile (${social})` } };
  }
  const builder = FREE_BUILDER_DOMAINS.find((d) => matchesDomain(parsed.host, d));
  if (builder) {
    return { status: "FREE_BUILDER", evidence: { url: parsed.url, httpStatus: null, dnsOk: null, reason: `Free builder / marketplace subdomain (${builder})` } };
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
    return { status: "UNKNOWN", evidence: { url, httpStatus: null, dnsOk: null, reason: "No network connectivity during probe; not classified" } };
  }
  if (!probe.dnsOk) {
    return { status: "DEAD", evidence: { url, httpStatus: null, dnsOk: false, reason: "Domain does not resolve (DNS failure)" } };
  }
  if (probe.finalUrl && probe.finalUrl !== url) {
    const redirected = classifyStatic(probe.finalUrl);
    if (redirected && redirected.status !== "NONE" && redirected.status !== "UNKNOWN") {
      return {
        status: redirected.status,
        evidence: { url, httpStatus: probe.httpStatus, dnsOk: true, reason: `Redirects to ${redirected.evidence.reason.toLowerCase()}` },
      };
    }
  }
  if (probe.httpStatus == null) {
    return { status: "DEAD", evidence: { url, httpStatus: null, dnsOk: true, reason: `No HTTP response (${probe.error ?? "timeout"})` } };
  }
  if (looksParked(probe.bodySnippet)) {
    return { status: "DEAD", evidence: { url, httpStatus: probe.httpStatus, dnsOk: true, reason: "Parked / for-sale / suspended domain page" } };
  }
  const s = probe.httpStatus;
  if (s >= 200 && s < 400) {
    return { status: "HAS_SITE", evidence: { url, httpStatus: s, dnsOk: true, reason: "Site responds normally" } };
  }
  if (s === 401 || s === 403 || s === 429) {
    return { status: "HAS_SITE", evidence: { url, httpStatus: s, dnsOk: true, reason: "Site is alive but blocks automated requests" } };
  }
  if (s === 404 || s === 410 || s >= 500) {
    return { status: "DEAD", evidence: { url, httpStatus: s, dnsOk: true, reason: `Persistent HTTP ${s} on the listed URL` } };
  }
  return { status: "UNKNOWN", evidence: { url, httpStatus: s, dnsOk: true, reason: `Ambiguous HTTP ${s}` } };
}

export async function classifySite(raw: string | null | undefined, probe: Probe): Promise<SiteClassification> {
  const fixed = classifyStatic(raw);
  if (fixed) return fixed;
  const parsed = normalizeUrl(raw)!;
  const result = await probe(parsed.url);
  return classifyProbe(parsed.url, result);
}
