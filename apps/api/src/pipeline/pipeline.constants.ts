export interface LeadJobData {
  leadId: string;
  campaignId: string;
}

export const LEAD_JOB_OPTS = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 3000 },
  removeOnComplete: 500,
  removeOnFail: 200,
};
