import { Injectable, Logger } from "@nestjs/common";
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { PipelineService } from "./pipeline.service";

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

/** One job per lead. The persisted `pipelineStage` makes each retry resume where it stopped. */
@Processor("pipeline", { concurrency: 4 })
@Injectable()
export class PipelineProcessor extends WorkerHost {
  private readonly logger = new Logger(PipelineProcessor.name);

  constructor(private pipeline: PipelineService) {
    super();
  }

  async process(job: Job<LeadJobData>): Promise<void> {
    await this.pipeline.processLead(job.data.leadId);
    await this.pipeline.finalizeCampaignIfDone(job.data.campaignId);
  }

  @OnWorkerEvent("failed")
  async onFailed(job: Job<LeadJobData> | undefined, err: Error): Promise<void> {
    if (!job) return;
    const exhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.warn(`Lead ${job.data.leadId} attempt ${job.attemptsMade} failed: ${err.message}`);
    if (!exhausted) return;
    await this.pipeline.markFailed(job.data.leadId, err.message);
    await this.pipeline.finalizeCampaignIfDone(job.data.campaignId);
  }
}
