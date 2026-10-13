export interface LeadJobData {
  leadId: string;
  campaignId: string;
}

/**
 * Per-lead jobs use a deterministic id and are removed when finished, so a lead can never be processed by
 * two workers at once (BullMQ ignores an `add` whose id is still waiting/active) but can be queued again later.
 */
export const leadJobOpts = (leadId: string) => ({
  jobId: `lead-${leadId}`,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 3000 },
  removeOnComplete: true,
  removeOnFail: true,
});
