import { Logger, BadRequestException, ConflictException, Controller, Post, Param, HttpCode, HttpStatus, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { CampaignsService } from "../campaigns/campaigns.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { ScraperJobData } from "./scraper.processor";

@ApiTags("Scraper")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("scraper")
export class ScraperController {
  private readonly logger = new Logger(ScraperController.name);

  constructor(
    @InjectQueue("scraper") private readonly scraperQueue: Queue<ScraperJobData>,
    private readonly campaigns: CampaignsService,
  ) {}

  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @Post("campaigns/:id/start")
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: "Start campaign scraping job" })
  async startCampaign(
    @Param("id") id: string,
    @WorkspaceId() workspaceId: string,
  ) {
    const campaign = await this.campaigns.findOne(id, workspaceId);
    if (!campaign.filter) {
      throw new BadRequestException("This campaign has no prospector filter (created before the Prospector upgrade). Create a new campaign.");
    }
    const STALE_RUN_MS = 30 * 60 * 1000; // a crashed run must not block restarts forever
    const stale = !campaign.startedAt || Date.now() - campaign.startedAt.getTime() > STALE_RUN_MS;
    if (campaign.status === "running" && !stale) throw new ConflictException("Campaign is already running");
    // Mark as running right away so a double click cannot enqueue the same campaign twice.
    await this.campaigns.updateStatus(campaign.id, "running", 0);
    let job;
    try {
      job = await this.scraperQueue.add(
        "scrape",
        {
          campaignId: campaign.id,
          workspaceId: campaign.workspaceId,
          filter: campaign.filter as unknown as ScraperJobData["filter"],
        },
        {
          attempts: 2,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );
    } catch (err) {
      // Redis down etc.: do not leave the campaign stuck in "running" with no job behind it.
      // A failure of this cleanup must not hide the original error.
      await this.campaigns
        .updateStatus(campaign.id, "failed", undefined, "Could not queue the campaign (is Redis running?)")
        .catch((e) => this.logger.error(`could not mark campaign ${campaign.id} as failed: ${String(e)}`));
      throw err;
    }
    return { message: "Campaign queued", campaignId: id, jobId: job.id };
  }
}
