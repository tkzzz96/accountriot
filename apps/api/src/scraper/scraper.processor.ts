import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue, Processor, WorkerHost } from "@nestjs/bullmq";
import { Job, Queue } from "bullmq";
import { CampaignsService } from "../campaigns/campaigns.service";
import { CampaignFilter } from "../campaigns/dto/campaign-filter.dto";
import { PipelineService } from "../pipeline/pipeline.service";
import { leadJobOpts, LeadJobData } from "../pipeline/pipeline.constants";

export interface ScraperJobData {
  campaignId: string;
  workspaceId: string;
  filter: CampaignFilter;
}

/** Campaign-level job: discover + classify + persist leads, then fan out one pipeline job per lead. */
@Processor("scraper")
@Injectable()
export class ScraperProcessor extends WorkerHost {
  private readonly logger = new Logger(ScraperProcessor.name);

  constructor(
    private campaigns: CampaignsService,
    private pipeline: PipelineService,
    @InjectQueue("pipeline") private pipelineQueue: Queue<LeadJobData>,
  ) {
    super();
  }

  async process(job: Job<ScraperJobData>): Promise<void> {
    const { campaignId, workspaceId, filter } = job.data;
    this.logger.log(`Starting campaign ${campaignId} (job ${job.id})`);
    try {
      await this.campaigns.updateStatus(campaignId, "running", 0);
      await this.pipeline.discoverAndClassify(campaignId, workspaceId, filter);

      // Enqueue every unfinished lead of the campaign (not only the new ones), so a retried
      // or restarted campaign also resumes leads stranded by an earlier failed attempt.
      const pending = await this.pipeline.pendingLeadIds(campaignId);
      if (pending.length === 0) {
        await this.pipeline.finalizeCampaignIfDone(campaignId);
        return;
      }
      await this.pipelineQueue.addBulk(pending.map((leadId) => ({ name: "lead", data: { leadId, campaignId }, opts: leadJobOpts(leadId) })));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Campaign ${campaignId} failed: ${message}`);
      await this.campaigns.updateStatus(campaignId, "failed", undefined, message);
      throw err; // BullMQ retries per job options
    }
  }
}
