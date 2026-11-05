import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
import { requireAdmin } from "../auth/roles";
import { CurrentUserId } from "../auth/current-user.decorator";
import { WorkspaceId } from "../auth/current-workspace.decorator";
import { ReferencesService } from "./references.service";

class AddReferenceDto {
  @IsString() @MaxLength(80) niche: string;
  @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(500) url: string;
  @IsString() @MaxLength(120) title: string;
  @IsOptional() @IsString() language?: string;
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) @MaxLength(1000) thumbUrl?: string;
}

@ApiTags("References")
@ApiBearerAuth()
@UseGuards(JwtGuard)
@Controller("references")
export class ReferencesController {
  constructor(private refs: ReferencesService, private prisma: PrismaService) {}

  @Get()
  list(@WorkspaceId() workspaceId: string, @Query("niche") niche?: string) {
    return this.refs.list(workspaceId, niche);
  }

  @Post()
  async add(@Body() dto: AddReferenceDto, @CurrentUserId() userId: string, @WorkspaceId() workspaceId: string) {
    // Edits only affect this workspace's own references (the global starter seed is read-only).
    await requireAdmin(this.prisma, workspaceId, userId);
    return this.refs.addCurated(workspaceId, dto);
  }
}
