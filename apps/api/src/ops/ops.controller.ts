import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { InjectQueue } from "@nestjs/bullmq";
import { ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { PrismaService } from "../prisma/prisma.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { startOfUtcDay } from "../outreach/llm-budget";

/** Operational read-model for the UI header/integrations page: real counts and real configuration status, no secrets. */
@ApiTags("Ops")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("ops")
export class OpsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    @InjectQueue("pipeline") private pipelineQueue: Queue,
    @InjectQueue("scraper") private scraperQueue: Queue,
  ) {}

  @Get("stats")
  @ApiOperation({ summary: "Pipeline, queue and integration status for the current workspace" })
  async stats(@WorkspaceId() workspaceId: string) {
    const [byStage, bySite, campaigns, llmToday, openai, pipelineCounts, scraperCounts] = await Promise.all([
      this.prisma.lead.groupBy({ by: ["pipelineStage"], where: { workspaceId }, _count: { _all: true } }),
      this.prisma.lead.groupBy({ by: ["siteStatus"], where: { workspaceId }, _count: { _all: true } }),
      this.prisma.campaign.groupBy({ by: ["status"], where: { workspaceId }, _count: { _all: true } }),
      this.prisma.leadActivity.count({ where: { type: "llm_draft", lead: { workspaceId }, createdAt: { gte: startOfUtcDay() } } }),
      this.prisma.integration.findFirst({ where: { workspaceId, type: "openai", enabled: true } }),
      this.pipelineQueue.getJobCounts("waiting", "active", "delayed", "failed"),
      this.scraperQueue.getJobCounts("waiting", "active", "delayed", "failed"),
    ]);
    const toMap = <K extends string>(rows: Array<{ _count: { _all: number } } & Record<string, unknown>>, key: K) =>
      Object.fromEntries(rows.map((r) => [String(r[key]), r._count._all]));
    const driver = this.config.get<string>("DISCOVERY_DRIVER") ?? "gosom";
    return {
      leadsByStage: toMap(byStage, "pipelineStage"),
      leadsBySiteStatus: toMap(bySite, "siteStatus"),
      campaignsByStatus: toMap(campaigns, "status"),
      integrations: {
        webhook: Boolean(this.config.get("LEAD_WEBHOOK_URL")),
        discoveryDriver: driver,
        placesConfigured: Boolean(this.config.get("PLACES_API_KEY")),
        llmConfigured: Boolean(this.config.get("OPENAI_API_KEY")) || Boolean(openai),
        pinterestConfigured: Boolean(this.config.get("PINTEREST_ACCESS_TOKEN")),
        smtpVerify: this.config.get("EMAIL_SMTP_VERIFY") === "true",
      },
      llm: { draftsToday: llmToday, dailyLimit: Number(this.config.get("LLM_DAILY_DRAFT_LIMIT") ?? 300) },
      queues: { pipeline: pipelineCounts, scraper: scraperCounts },
    };
  }
}
