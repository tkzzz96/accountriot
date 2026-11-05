import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { PinterestProvider } from "./providers/pinterest.provider";

const cfg = (env: Record<string, string>) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;

describe("PinterestProvider", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("is disabled and makes no request without a token", async () => {
    const f = vi.fn();
    vi.stubGlobal("fetch", f);
    const p = new PinterestProvider(cfg({}));
    expect(p.enabled).toBe(false);
    expect(await p.find("padaria")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("maps pins to link + hotlinked thumbnail URL only (no image download)", async () => {
    const f = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [
        { link: "https://site.com", title: "Site", media: { images: { "400x300": { url: "https://i.pinimg.com/a.jpg" } } } },
        { title: "no link", media: { images: {} } },
      ] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", f);
    const out = await new PinterestProvider(cfg({ PINTEREST_ACCESS_TOKEN: "t" })).find("padaria");
    expect(out).toEqual([{ url: "https://site.com", thumbUrl: "https://i.pinimg.com/a.jpg", source: "pinterest", niche: "padaria", title: "Site" }]);
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0][0])).toContain("api.pinterest.com");
  });

  it("throws on API errors so the caller can fall back to curated references", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("x", { status: 401 })));
    await expect(new PinterestProvider(cfg({ PINTEREST_ACCESS_TOKEN: "t" })).find("x")).rejects.toThrow(/401/);
  });
});
