import { Throttle } from "@nestjs/throttler";
import { Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";
import { IsIn, IsOptional } from "class-validator";
import { PipelineService } from "../pipeline/pipeline.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

const SITE_STATUSES = ["NONE", "SOCIAL_ONLY", "FREE_BUILDER", "DEAD", "HAS_SITE", "UNKNOWN"];
const STAGES = ["DISCOVERED", "CLASSIFIED", "ENRICHED", "SCORED", "DRAFTED", "READY", "FAILED"];

class RegenerateDraftDto {
  @IsOptional() @IsIn(["whatsapp", "email"]) channel?: "whatsapp" | "email";
  @IsOptional() @IsIn(["pt-BR", "en"]) lang?: "pt-BR" | "en";
}

@ApiTags("Leads")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("leads")
export class LeadsController {
  constructor(private readonly leadsService: LeadsService, private readonly pipeline: PipelineService) {}

  @Get()
  @ApiOperation({ summary: "List all leads" })
  @ApiQuery({ name: "campaignId", required: false })
  @ApiQuery({ name: "q", required: false, description: "Search by name" })
  @ApiQuery({ name: "priority", required: false, enum: ["HIGH", "MEDIUM", "LOW"] })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "siteStatus", required: false, enum: ["NONE", "SOCIAL_ONLY", "FREE_BUILDER", "DEAD", "HAS_SITE", "UNKNOWN"] })
  @ApiQuery({ name: "stage", required: false, description: "One stage or a comma-separated list, e.g. CLASSIFIED,ENRICHED" })
  @ApiQuery({ name: "minScore", required: false, type: Number })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @WorkspaceId() workspaceId: string,
    @Query("campaignId") campaignId?: string,
    @Query("q") q?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("siteStatus") siteStatus?: string,
    @Query("stage") stage?: string,
    @Query("minScore") minScore?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.leadsService.findAll(workspaceId, {
      campaignId, q, priority, status,
      siteStatus: SITE_STATUSES.includes(siteStatus as string) ? siteStatus : undefined,
      stage: stage && stage.split(",").every((x) => STAGES.includes(x)) ? stage : undefined,
      minScore: minScore ? Number(minScore) : undefined,
      page: page ? Number.parseInt(page, 10) : undefined,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get lead by ID" })
  findOne(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.leadsService.findOne(id, workspaceId);
  }

  @Patch(":id/crm")
  @ApiOperation({ summary: "Update CRM status for a lead" })
  updateCrm(@Param("id") id: string, @Body() dto: UpdateCrmDto, @WorkspaceId() workspaceId: string) {
    return this.leadsService.updateCrm(id, dto, workspaceId);
  }

  @Post(":id/retry")
  @HttpCode(202)
  @ApiOperation({ summary: "Re-run the pipeline for a FAILED lead" })
  retry(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    return this.pipeline.retryLead(id, workspaceId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(":id/draft")
  @ApiOperation({ summary: "Regenerate the message draft (never sends)" })
  regenerateDraft(@Param("id") id: string, @Body() dto: RegenerateDraftDto, @WorkspaceId() workspaceId: string) {
    return this.pipeline.draftForLead(id, workspaceId, dto.channel, dto.lang);
  }

  @Delete(":id")
  @HttpCode(204)
  @ApiOperation({ summary: "Permanently erase a lead (LGPD/GDPR)" })
  async remove(@Param("id") id: string, @WorkspaceId() workspaceId: string) {
    await this.pipeline.deleteLead(id, workspaceId);
  }
}
