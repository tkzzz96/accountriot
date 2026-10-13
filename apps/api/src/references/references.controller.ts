import { Body, Controller, ForbiddenException, Get, Post, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { JwtGuard } from "../auth/jwt.guard";
import { PrismaService } from "../prisma/prisma.service";
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
  list(@Query("niche") niche?: string) {
    return this.refs.list(niche);
  }

  @Post()
  async add(@Body() dto: AddReferenceDto, @CurrentUserId() userId: string, @WorkspaceId() workspaceId: string) {
    // The curated list is shared by every workspace: only owners/admins may change it.
    const m = await this.prisma.workspaceMember.findUnique({ where: { workspaceId_userId: { workspaceId, userId } } });
    if (!m || !["owner", "admin"].includes(m.role)) throw new ForbiddenException("Only workspace owners and admins can edit references");
    return this.refs.addCurated(dto);
  }
}
