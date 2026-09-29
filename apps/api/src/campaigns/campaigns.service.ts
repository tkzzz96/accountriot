import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCampaignDto } from "./dto/create-campaign.dto";
import { UpdateCampaignDto } from "./dto/update-campaign.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class CampaignsService {
  constructor(private prisma: PrismaService) {}

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.campaign.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { leads: true } } },
    });
  }

  async findOne(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, workspaceId },
      include: { _count: { select: { leads: true } } },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async create(dto: CreateCampaignDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.prisma.workspace.upsert({
      where: { id: workspaceId },
      create: { id: workspaceId, name: "Default Workspace", slug: "default" },
      update: {},
    });
    const { filter, ...rest } = dto;
    const industry = rest.industry ?? filter?.niche;
    const location = rest.location ?? (filter ? [filter.city, filter.country].filter(Boolean).join(", ") : undefined);
    const yourService = rest.yourService ?? filter?.service ?? "Website development";
    if (!industry || !location) {
      throw new BadRequestException("Provide either filter (niche/city/country) or industry + location");
    }
    return this.prisma.campaign.create({
      data: {
        ...rest,
        industry,
        location,
        yourService,
        searchQueries: rest.searchQueries ?? (filter ? [filter.niche] : [industry]),
        maxResults: filter?.maxResults ?? rest.maxResults ?? 20,
        contentStyle: rest.contentStyle ?? "balanced",
        language: filter?.language ?? rest.language ?? "indonesian",
        filter: filter ? (JSON.parse(JSON.stringify(filter)) as object) : undefined,
        workspaceId,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    const { filter, ...rest } = dto;
    return this.prisma.campaign.update({
      where: { id },
      data: { ...rest, ...(filter && { filter: JSON.parse(JSON.stringify(filter)) as object }) },
    });
  }

  async remove(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    return this.prisma.campaign.delete({ where: { id } });
  }

  async updateStatus(id: string, status: string, progress?: number, error?: string) {
    return this.prisma.campaign.update({
      where: { id },
      data: {
        status,
        ...(progress !== undefined && { progress }),
        ...(error && { error }),
        ...(status === "running" && { startedAt: new Date() }),
        ...(status === "completed" && { completedAt: new Date() }),
      },
    });
  }

  async updateStats(id: string, stats: {
    totalLeads?: number;
    priorityLeads?: number;
    highQualityLeads?: number;
    averageScore?: number;
  }) {
    return this.prisma.campaign.update({ where: { id }, data: stats });
  }
}
