import { describe, expect, it } from "vitest";
import { clearSessionCookies, csrfMatches, durationToMs, newCsrfToken, parseCookies, setSessionCookies, CSRF_COOKIE, SESSION_COOKIE } from "./session";

describe("parseCookies", () => {
  it("parses pairs, decodes values and keeps the first duplicate", () => {
    expect(parseCookies("a=1; b=x%20y; a=2")).toEqual({ a: "1", b: "x y" });
  });
  it("tolerates garbage and undefined", () => {
    expect(parseCookies(undefined)).toEqual({});
    expect(parseCookies("novalue; =x; c=%E0%A4%A")).toEqual({ c: "%E0%A4%A" });
  });
});

describe("csrfMatches", () => {
  it("matches equal tokens only", () => {
    const t = newCsrfToken();
    expect(csrfMatches(t, t)).toBe(true);
    expect(csrfMatches(t, `${t}x`)).toBe(false);
    expect(csrfMatches(t, undefined)).toBe(false);
    expect(csrfMatches(undefined, t)).toBe(false);
    expect(csrfMatches("", "")).toBe(false);
  });
});

describe("durationToMs", () => {
  it("parses units and falls back", () => {
    expect(durationToMs("7d")).toBe(7 * 86400_000);
    expect(durationToMs("12h")).toBe(12 * 3600_000);
    expect(durationToMs("30m")).toBe(30 * 60_000);
    expect(durationToMs("90")).toBe(90_000);
    expect(durationToMs("abc", 5)).toBe(5);
    expect(durationToMs(undefined, 7)).toBe(7);
  });
});

describe("cookies", () => {
  it("session cookie is httpOnly, CSRF cookie is script-readable", () => {
    const set: Array<[string, string, Record<string, unknown>]> = [];
    const cleared: string[] = [];
    const res = { cookie: (n: string, v: string, o: Record<string, unknown>) => set.push([n, v, o]), clearCookie: (n: string) => cleared.push(n) };
    setSessionCookies(res, "jwt", 1000);
    expect(set.find((c) => c[0] === SESSION_COOKIE)?.[2]).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/", maxAge: 1000 });
    expect(set.find((c) => c[0] === CSRF_COOKIE)?.[2]).toMatchObject({ httpOnly: false });
    clearSessionCookies(res);
    expect(cleared.sort()).toEqual([CSRF_COOKIE, SESSION_COOKIE].sort());
  });
});
