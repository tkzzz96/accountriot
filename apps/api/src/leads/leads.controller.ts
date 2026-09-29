import { Controller, Get, Patch, Post, Delete, Param, Body, Query, UseGuards, HttpCode } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { LeadsService } from "./leads.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";
import { IsIn, IsOptional } from "class-validator";
import { PipelineService } from "../pipeline/pipeline.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";

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
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  findAll(
    @WorkspaceId() workspaceId: string,
    @Query("campaignId") campaignId?: string,
    @Query("q") q?: string,
    @Query("priority") priority?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("limit") limit?: string,
  ) {
    return this.leadsService.findAll(workspaceId, {
      campaignId, q, priority, status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
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
