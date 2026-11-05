import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BulkLeadsDto } from "./dto/bulk.dto";
import { leadWebhookPayload, signBody } from "./webhook";
import { PrismaService } from "../prisma/prisma.service";
import { UpdateCrmDto } from "./dto/update-crm.dto";

const DEFAULT_WORKSPACE_ID = "default-workspace";

export interface LeadFilter {
  campaignId?: string;
  q?: string;
  priority?: string;
  status?: string;
  siteStatus?: string;
  stage?: string;
  minScore?: number;
  page?: number;
  limit?: number;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private prisma: PrismaService, private config: ConfigService) {}

  /** Applies one action to up to 200 leads of the caller's workspace (ids from other workspaces are ignored). */
  async bulk(dto: BulkLeadsDto, workspaceId: string): Promise<{ affected: number }> {
    const owned = await this.prisma.lead.findMany({ where: { id: { in: dto.ids }, workspaceId }, select: { id: true } });
    const ids = owned.map((l) => l.id);
    if (ids.length === 0) return { affected: 0 };
    if (dto.action === "delete") {
      const res = await this.prisma.lead.deleteMany({ where: { id: { in: ids }, workspaceId } });
      return { affected: res.count };
    }
    if (!dto.crmStatus && dto.crmNotes === undefined) throw new BadRequestException("crmStatus or crmNotes is required for action 'crm'");
    const now = new Date();
    const data = {
      ...(dto.crmStatus && { crmStatus: dto.crmStatus }),
      ...(dto.crmNotes !== undefined && { crmNotes: dto.crmNotes }),
      ...(dto.crmStatus === "contacted" && { contactedAt: now }),
      ...(dto.crmStatus === "replied" && { repliedAt: now }),
      ...(dto.crmStatus === "won" || dto.crmStatus === "lost" ? { closedAt: now } : {}),
    };
    const res = await this.prisma.lead.updateMany({ where: { id: { in: ids }, workspaceId }, data });
    await this.prisma.leadActivity.createMany({
      data: ids.map((leadId) => ({ leadId, type: "crm_update", note: `Status changed to ${dto.crmStatus ?? "(notes)"}`, metadata: { bulk: true, crmStatus: dto.crmStatus ?? null } })),
    });
    return { affected: res.count };
  }

  /** POSTs the lead (with its DRAFT, never a sent message) to LEAD_WEBHOOK_URL, signed with LEAD_WEBHOOK_SECRET when set. */
  async exportToWebhook(id: string, workspaceId: string): Promise<{ delivered: true; status: number }> {
    const url = this.config.get<string>("LEAD_WEBHOOK_URL");
    if (!url) throw new ServiceUnavailableException("LEAD_WEBHOOK_URL is not configured");
    const lead = await this.prisma.lead.findFirst({ where: { id, workspaceId } });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    const body = JSON.stringify(leadWebhookPayload(lead));
    const secret = this.config.get<string>("LEAD_WEBHOOK_SECRET");
    const headers: Record<string, string> = { "content-type": "application/json", "user-agent": "prospector-webhook/1" };
    if (secret) headers["x-prospector-signature"] = signBody(body, secret);
    let res: Response;
    try {
      res = await fetch(url, { method: "POST", headers, body, redirect: "manual", signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      this.logger.warn(`Lead webhook failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadGatewayException("Webhook endpoint unreachable");
    }
    if (!res.ok) throw new BadGatewayException(`Webhook responded ${res.status}`);
    await this.prisma.leadActivity.create({ data: { leadId: id, type: "webhook_export", note: `Exported to webhook (${res.status})` } });
    return { delivered: true, status: res.status };
  }

  async findAll(workspaceId = DEFAULT_WORKSPACE_ID, filter: LeadFilter = {}) {
    const { campaignId, q, priority, status, siteStatus, stage, minScore } = filter;
    // Clamp paging input: bounded page size, 1-based page.
    const int = (v: number | undefined, fallback: number) => (Number.isFinite(v) ? Math.trunc(v as number) : fallback);
    const limit = Math.min(200, Math.max(1, int(filter.limit, 50)));
    const page = Math.max(1, int(filter.page, 1));
    const skip = (page - 1) * limit;

    const where = {
      workspaceId,
      ...(campaignId && { campaignId }),
      ...(priority && { priority }),
      ...(status && { crmStatus: status }),
      ...(siteStatus && { siteStatus: siteStatus as never }),
      ...(stage && { pipelineStage: { in: stage.split(",") as never[] } }),
      ...(minScore != null && !Number.isNaN(minScore) && { score: { gte: minScore } }),
      ...(q && { name: { contains: q, mode: "insensitive" as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        skip,
        take: limit,
        // List rows only need summary fields; the heavy JSON and activities are served by findOne().
        omit: { aiAnalysis: true, marketingContent: true, budgetSignals: true, references: true, siteEvidence: false },
        include: { campaign: { select: { id: true, name: true } } },
      }),
      this.prisma.lead.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const lead = await this.prisma.lead.findFirst({
      where: { id, workspaceId },
      include: {
        activities: { orderBy: { createdAt: "desc" } },
        campaign: { select: { id: true, name: true } },
        followUps: { where: { done: false }, orderBy: { scheduledAt: "asc" } },
      },
    });
    if (!lead) throw new NotFoundException(`Lead ${id} not found`);
    return lead;
  }

  async updateCrm(id: string, dto: UpdateCrmDto, workspaceId = DEFAULT_WORKSPACE_ID) {
    await this.findOne(id, workspaceId);
    const now = new Date();
    const lead = await this.prisma.lead.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.crmStatus === "contacted" && { contactedAt: now }),
        ...(dto.crmStatus === "replied" && { repliedAt: now }),
        ...(["won", "lost"].includes(dto.crmStatus ?? "") && { closedAt: now }),
      },
    });
    await this.prisma.leadActivity.create({
      data: {
        leadId: id,
        type: "crm_update",
        note: `Status changed to ${dto.crmStatus}`,
        metadata: dto as object,
      },
    });
    return lead;
  }

  async createMany(leads: Array<{
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    phone?: string;
    website?: string;
    rating?: string;
    reviewCount?: number;
    hasWebsite?: boolean;
    referenceUrl?: string;
    score?: number;
    priority?: string;
    marketingContent?: object;
    aiAnalysis?: object;
    campaignId: string;
    workspaceId: string;
  }>) {
    return this.prisma.lead.createMany({ data: leads, skipDuplicates: true });
  }
}
