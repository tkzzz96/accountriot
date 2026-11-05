import { describe, expect, it } from "vitest";
import { startOfUtcDay, withinBudget } from "./llm-budget";

describe("llm budget", () => {
  it("starts the window at 00:00 UTC", () => {
    expect(startOfUtcDay(new Date("2026-03-05T23:59:59Z")).toISOString()).toBe("2026-03-05T00:00:00.000Z");
  });
  it("is within budget only below the limit; 0 disables", () => {
    expect(withinBudget(0, 3)).toBe(true);
    expect(withinBudget(2, 3)).toBe(true);
    expect(withinBudget(3, 3)).toBe(false);
    expect(withinBudget(0, 0)).toBe(false);
    expect(withinBudget(0, -1)).toBe(false);
  });
});
