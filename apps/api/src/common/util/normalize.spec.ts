import { describe, it, expect } from "vitest";
import { normalizePhone, buildDedupeKey, normalizeText } from "./normalize";

describe("normalizePhone", () => {
  it("BR mobile with mask", () => expect(normalizePhone("(11) 99999-8888")).toBe("+5511999998888"));
  it("keeps explicit country", () => expect(normalizePhone("+1 415 555 0100")).toBe("+14155550100"));
  it("00 prefix", () => expect(normalizePhone("00351 912 345 678")).toBe("+351912345678"));
  it("rejects junk", () => expect(normalizePhone("abc")).toBeNull());
  it("rejects too short", () => expect(normalizePhone("123")).toBeNull());
});
describe("dedupe", () => {
  it("same phone different format collide", () =>
    expect(buildDedupeKey({ name: "A", phone: "(11) 99999-8888" })).toBe(buildDedupeKey({ name: "B", phone: "+55 11 99999 8888" })));
  it("falls back to name+address, accent-insensitive", () =>
    expect(buildDedupeKey({ name: "Padaria Zé", address: "Rua Á, 1" })).toBe(buildDedupeKey({ name: "padaria ze", address: "rua a 1" })));
  it("normalizeText", () => expect(normalizeText("  Café  Só! ")).toBe("cafe so"));
});
