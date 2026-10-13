import { describe, expect, it } from "vitest";
import { csvCell } from "./csv";

describe("csvCell", () => {
  it("passes plain text", () => expect(csvCell("Padaria")).toBe("Padaria"));
  it("null/undefined -> empty", () => { expect(csvCell(null)).toBe(""); expect(csvCell(undefined)).toBe(""); });
  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("l1\nl2")).toBe('"l1\nl2"');
  });
  for (const evil of ["=HYPERLINK(\"http://x\")", "+cmd|' /C calc'!A0", "-2+3", "@SUM(A1)", "\t=1+1"]) {
    it(`neutralizes formula ${JSON.stringify(evil).slice(0, 24)}`, () => expect(csvCell(evil).replace(/^"/, "").startsWith("'")).toBe(true));
  }
  it("keeps real phone numbers untouched", () => {
    expect(csvCell("+5541998887766")).toBe("+5541998887766");
    expect(csvCell("+55 (41) 99888-7766")).toBe("+55 (41) 99888-7766");
  });
  it("numbers stay numbers", () => expect(csvCell(42)).toBe("42"));
});
