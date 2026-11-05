import { Controller, Get, Post, Delete, Body, Param, UseGuards, BadRequestException } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiBearerAuth } from "@nestjs/swagger";
import { SettingsService } from "./settings.service";
import { JwtGuard } from "../auth/jwt.guard";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { CurrentUserId } from "../auth/current-user.decorator";
import { requireAdmin } from "../auth/roles";
import { PrismaService } from "../prisma/prisma.service";
import { CreateApiKeyDto, UpsertIntegrationDto } from "./dto";

const MAX_CONFIG_KEYS = 20;
const MAX_CONFIG_VALUE = 2000;

@ApiTags("Settings")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("settings")
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("integrations")
  @ApiOperation({ summary: "List workspace integrations (secrets are masked)" })
  getIntegrations(@WorkspaceId() workspaceId: string) {
    return this.settingsService.getIntegrations(workspaceId);
  }

  @Post("integrations")
  @ApiOperation({ summary: "Save or update an integration (owner/admin, signed-in user only)" })
  async upsertIntegration(@WorkspaceId() workspaceId: string, @CurrentUserId() userId: string, @Body() body: UpsertIntegrationDto) {
    await requireAdmin(this.prisma, workspaceId, userId);
    const entries = Object.entries(body.config);
    if (entries.length > MAX_CONFIG_KEYS || entries.some(([k, v]) => typeof v !== "string" || v.length > MAX_CONFIG_VALUE || k.length > 60)) {
      throw new BadRequestException("Invalid integration config");
    }
    return this.settingsService.upsertIntegration(body.type, body.name, body.config, workspaceId);
  }

  @Get("api-keys")
  @ApiOperation({ summary: "List API keys" })
  listApiKeys(@WorkspaceId() workspaceId: string) {
    return this.settingsService.listApiKeys(workspaceId);
  }

  @Post("api-keys")
  @ApiOperation({ summary: "Create a new API key (owner/admin, signed-in user only: keys cannot mint keys)" })
  async createApiKey(@WorkspaceId() workspaceId: string, @CurrentUserId() userId: string, @Body() body: CreateApiKeyDto) {
    await requireAdmin(this.prisma, workspaceId, userId);
    return this.settingsService.createApiKey(body.name, workspaceId);
  }

  @Delete("api-keys/:id")
  @ApiOperation({ summary: "Delete an API key (owner/admin, signed-in user only)" })
  async deleteApiKey(@Param("id") id: string, @WorkspaceId() workspaceId: string, @CurrentUserId() userId: string) {
    await requireAdmin(this.prisma, workspaceId, userId);
    return this.settingsService.deleteApiKey(id, workspaceId);
  }
}
