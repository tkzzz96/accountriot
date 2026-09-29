import { describe, it, expect } from "vitest";
import { classifySite, classifyStatic, classifyProbe, looksParked, normalizeUrl, Probe } from "./site-classifier";

const okProbe: Probe = async (url) => ({ dnsOk: true, httpStatus: 200, finalUrl: url, bodySnippet: "<html>Welcome</html>" });

describe("classifyStatic", () => {
  const cases: Array<[string, string | null | undefined, string]> = [
    ["empty string", "", "NONE"],
    ["null", null, "NONE"],
    ["undefined", undefined, "NONE"],
    ["whitespace", "   ", "NONE"],
    ["instagram", "https://instagram.com/loja", "SOCIAL_ONLY"],
    ["instagram www", "https://www.instagram.com/loja/", "SOCIAL_ONLY"],
    ["instagram no scheme", "instagram.com/loja", "SOCIAL_ONLY"],
    ["facebook", "facebook.com/padaria", "SOCIAL_ONLY"],
    ["facebook mobile", "https://m.facebook.com/padaria", "SOCIAL_ONLY"],
    ["linktree", "https://linktr.ee/loja", "SOCIAL_ONLY"],
    ["wa.me", "https://wa.me/5511999999999", "SOCIAL_ONLY"],
    ["tiktok", "https://www.tiktok.com/@loja", "SOCIAL_ONLY"],
    ["beacons", "https://beacons.ai/loja", "SOCIAL_ONLY"],
    ["google sites listing", "https://g.page/loja", "SOCIAL_ONLY"],
    ["wixsite", "https://loja.wixsite.com/home", "FREE_BUILDER"],
    ["business.site", "https://loja.business.site", "FREE_BUILDER"],
    ["weebly", "http://loja.weebly.com", "FREE_BUILDER"],
    ["blogspot", "https://loja.blogspot.com", "FREE_BUILDER"],
    ["carrd", "https://loja.carrd.co", "FREE_BUILDER"],
    ["godaddysites", "https://loja.godaddysites.com", "FREE_BUILDER"],
    ["google sites", "https://sites.google.com/view/loja", "FREE_BUILDER"],
    ["wordpress.com", "https://loja.wordpress.com", "FREE_BUILDER"],
    ["canva site", "https://loja.my.canva.site", "FREE_BUILDER"],
    ["webflow.io", "https://loja.webflow.io", "FREE_BUILDER"],
    ["real domain", "https://www.lojadojoao.com.br", null as unknown as string],
    ["garbage", "not a url at all", "UNKNOWN"],
    ["mailto", "mailto:a@b.com", "UNKNOWN"],
    ["lookalike must not match", "https://notinstagram.com", null as unknown as string],
    ["lookalike suffix must not match", "https://myfacebook.com.br", null as unknown as string],
    ["ftp scheme", "ftp://files.example.com", "UNKNOWN"],
  ];
  for (const [label, input, expected] of cases) {
    it(label, () => {
      const r = classifyStatic(input);
      if (expected === null) expect(r).toBeNull();
      else expect(r?.status).toBe(expected);
    });
  }
  it("always records evidence reason", () => {
    expect(classifyStatic("")?.evidence.reason).toMatch(/No website/);
    expect(classifyStatic("https://instagram.com/x")?.evidence.url).toContain("instagram.com");
  });
});

describe("classifyProbe", () => {
  const u = "https://example.com/";
  it("DNS failure -> DEAD", () => expect(classifyProbe(u, { dnsOk: false, httpStatus: null }).status).toBe("DEAD"));
  it("offline -> UNKNOWN (never DEAD)", () => expect(classifyProbe(u, { dnsOk: false, offline: true, httpStatus: null }).status).toBe("UNKNOWN"));
  it("timeout -> DEAD", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: null, error: "aborted" }).status).toBe("DEAD"));
  it("200 -> HAS_SITE", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 200 }).status).toBe("HAS_SITE"));
  it("301 final ok -> HAS_SITE", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 301 }).status).toBe("HAS_SITE"));
  it("403 -> HAS_SITE (bot block)", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 403 }).status).toBe("HAS_SITE"));
  it("404 -> DEAD", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 404 }).status).toBe("DEAD"));
  it("503 -> DEAD", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 503 }).status).toBe("DEAD"));
  it("418 -> UNKNOWN", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 418 }).status).toBe("UNKNOWN"));
  it("parked page -> DEAD", () =>
    expect(classifyProbe(u, { dnsOk: true, httpStatus: 200, bodySnippet: "This domain is for sale!" }).status).toBe("DEAD"));
  it("redirect to instagram -> SOCIAL_ONLY", () =>
    expect(classifyProbe(u, { dnsOk: true, httpStatus: 200, finalUrl: "https://www.instagram.com/loja" }).status).toBe("SOCIAL_ONLY"));
  it("redirect to wixsite -> FREE_BUILDER", () =>
    expect(classifyProbe(u, { dnsOk: true, httpStatus: 200, finalUrl: "https://a.wixsite.com/x" }).status).toBe("FREE_BUILDER"));
  it("evidence carries http status", () => expect(classifyProbe(u, { dnsOk: true, httpStatus: 404 }).evidence.httpStatus).toBe(404));
});

describe("classifySite (with probe)", () => {
  it("skips probe for social", async () => {
    let called = false;
    const r = await classifySite("instagram.com/x", async (url) => { called = true; return okProbe(url); });
    expect(r.status).toBe("SOCIAL_ONLY");
    expect(called).toBe(false);
  });
  it("real domain alive -> HAS_SITE", async () => expect((await classifySite("lojadojoao.com.br", okProbe)).status).toBe("HAS_SITE"));
  it("real domain dead", async () =>
    expect((await classifySite("lojadojoao.com.br", async () => ({ dnsOk: false, httpStatus: null }))).status).toBe("DEAD"));
});

describe("helpers", () => {
  it("normalizeUrl adds scheme and strips www", () => expect(normalizeUrl("WWW.Foo.com/a")?.host).toBe("foo.com"));
  it("looksParked", () => expect(looksParked("Buy this domain today")).toBe(true));
  it("not parked", () => expect(looksParked("Padaria do Zé")).toBe(false));
});
