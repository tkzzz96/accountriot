import { describe, expect, it } from "vitest";
import { isMasked, maskSecrets } from "./settings.service";

describe("secret masking", () => {
  it("masks apiKey but keeps the last 4 chars, leaves other fields alone", () => {
    const m = maskSecrets({ apiKey: "sk-abcdef123456", model: "gpt-4o-mini" });
    expect(m.apiKey).toBe("••••3456");
    expect(m.apiKey).not.toContain("abcdef");
    expect(m.model).toBe("gpt-4o-mini");
  });
  it("does not invent a key when none is stored", () => {
    expect(maskSecrets({ model: "x" })).toEqual({ model: "x" });
  });
  it("recognises a masked value coming back from the UI", () => {
    expect(isMasked("••••3456")).toBe(true);
    expect(isMasked("sk-real")).toBe(false);
    expect(isMasked(undefined)).toBe(false);
  });
});
