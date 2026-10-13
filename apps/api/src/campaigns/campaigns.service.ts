import { Injectable, NotFoundException } from "@nestjs/common";
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
    const { filter, name, description } = dto;
    return this.prisma.campaign.create({
      data: {
        name,
        description,
        // Legacy columns are kept (NOT NULL in the schema) and derived from the filter.
        industry: filter.niche,
        location: [filter.city, filter.country].filter(Boolean).join(", "),
        yourService: filter.service ?? "Website development",
        searchQueries: [filter.niche],
        maxResults: filter.maxResults ?? 50,
        contentStyle: "balanced",
        language: filter.language,
        filter: JSON.parse(JSON.stringify(filter)) as object,
        workspaceId,
      },
    });
  }

  async update(id: string, dto: UpdateCampaignDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    const { filter, name, description } = dto;
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(filter && {
          filter: JSON.parse(JSON.stringify(filter)) as object,
          industry: filter.niche,
          location: [filter.city, filter.country].filter(Boolean).join(", "),
          language: filter.language,
          maxResults: filter.maxResults ?? 50,
          searchQueries: [filter.niche],
          yourService: filter.service ?? "Website development",
        }),
      },
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
        // A fresh run (progress 0) resets timestamps/error; later progress ticks must not touch startedAt.
        ...(status === "running" && progress === 0 && { startedAt: new Date(), completedAt: null, error: null }),
        ...(status === "completed" && { completedAt: new Date(), error: null }),
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
