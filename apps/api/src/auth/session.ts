// Browser sessions: an httpOnly JWT cookie (unreadable by scripts => XSS cannot steal it) plus a CSRF double-submit cookie.
import { createHash, randomBytes, timingSafeEqual } from "crypto";

export const SESSION_COOKIE = "prospector_session";
export const CSRF_COOKIE = "prospector_csrf";
export const CSRF_HEADER = "x-csrf-token";

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k || k in out) continue;
    try {
      out[k] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[k] = part.slice(i + 1).trim();
    }
  }
  return out;
}

export const newCsrfToken = (): string => randomBytes(24).toString("base64url");

/** Constant-time comparison of the CSRF header against the CSRF cookie. */
export function csrfMatches(cookieValue: string | undefined, headerValue: string | undefined): boolean {
  if (!cookieValue || !headerValue) return false;
  const a = createHash("sha256").update(cookieValue).digest();
  const b = createHash("sha256").update(headerValue).digest();
  return timingSafeEqual(a, b);
}

export const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface CookieResponse {
  cookie(name: string, value: string, opts: Record<string, unknown>): unknown;
  clearCookie(name: string, opts: Record<string, unknown>): unknown;
}

const secure = () => process.env.COOKIE_SECURE === "true" || (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false");

export function setSessionCookies(res: CookieResponse, jwt: string, maxAgeMs: number): void {
  const base = { sameSite: "lax", secure: secure(), path: "/", maxAge: maxAgeMs };
  res.cookie(SESSION_COOKIE, jwt, { ...base, httpOnly: true });
  res.cookie(CSRF_COOKIE, newCsrfToken(), { ...base, httpOnly: false }); // readable on purpose: the page echoes it in a header
}

export function clearSessionCookies(res: CookieResponse): void {
  const base = { sameSite: "lax", secure: secure(), path: "/" };
  res.clearCookie(SESSION_COOKIE, { ...base, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...base, httpOnly: false });
}

/** Parses "7d", "12h", "30m", "3600" (seconds) into milliseconds. */
export function durationToMs(v: string | undefined, fallbackMs = 7 * 86400_000): number {
  const m = /^(\d+)\s*([smhd]?)$/.exec((v ?? "").trim());
  if (!m) return fallbackMs;
  const n = Number(m[1]);
  return n * ({ s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, "": 1000 } as Record<string, number>)[m[2]];
}
