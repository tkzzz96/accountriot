/** Start of the current UTC day: the window used to count LLM-generated drafts against the daily cap. */
export function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/** True while `used` is below `limit`. A limit of 0 (or negative) disables the LLM entirely. */
export function withinBudget(used: number, limit: number): boolean {
  return limit > 0 && used < limit;
}
