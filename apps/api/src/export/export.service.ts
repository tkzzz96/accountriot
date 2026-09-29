import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_WORKSPACE_ID = "default-workspace";

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async getLeads(workspaceId = DEFAULT_WORKSPACE_ID, campaignId?: string) {
    return this.prisma.lead.findMany({
      where: { workspaceId, ...(campaignId && { campaignId }) },
      orderBy: [{ priority: "asc" }, { score: "desc" }],
      include: { campaign: { select: { name: true } } },
    });
  }

  toCsv(leads: Awaited<ReturnType<typeof this.getLeads>>): string {
    const headers = [
      "Name", "Address", "Phone", "Website", "Rating", "Review Count", "Score", "Priority",
      "CRM Status", "Campaign", "Has Website", "Scraped At",
      "Site Status", "Site Evidence", "WhatsApp", "Email", "Contact Source", "Contact Type",
      "Budget Score", "Budget Label", "Pipeline Stage", "Draft Channel", "Draft", "References",
    ];
    const escape = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const rows = leads.map((l) => [
      l.name, l.address, l.phone, l.website, l.rating, l.reviewCount, l.score, l.priority,
      l.crmStatus, l.campaign?.name ?? "", l.hasWebsite ? "Yes" : "No",
      new Date(l.scrapedAt).toISOString(),
      l.siteStatus, (l.siteEvidence as { reason?: string } | null)?.reason ?? "", l.whatsapp, l.email, l.contactSource, l.ownerContactType,
      l.budgetScore, (l.budgetSignals as { label?: string } | null)?.label ?? "", l.pipelineStage,
      (l.marketingContent as { channel?: string } | null)?.channel ?? "",
      (l.marketingContent as { text?: string } | null)?.text ?? "",
      ((l.references as Array<{ url: string }> | null) ?? []).map((r) => r.url).join(" | "),
    ].map(escape).join(","));
    return [headers.join(","), ...rows].join("\n");
  }

  toJson(leads: Awaited<ReturnType<typeof this.getLeads>>) {
    return leads.map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      lat: l.lat,
      lng: l.lng,
      phone: l.phone,
      website: l.website,
      rating: l.rating,
      reviewCount: l.reviewCount,
      score: l.score,
      priority: l.priority,
      crmStatus: l.crmStatus,
      crmNotes: l.crmNotes,
      hasWebsite: l.hasWebsite,
      campaign: l.campaign?.name,
      marketingContent: l.marketingContent,
      siteStatus: l.siteStatus,
      siteEvidence: l.siteEvidence,
      whatsapp: l.whatsapp,
      email: l.email,
      contactSource: l.contactSource,
      ownerContactType: l.ownerContactType,
      budgetScore: l.budgetScore,
      budgetSignals: l.budgetSignals,
      references: l.references,
      pipelineStage: l.pipelineStage,
      scrapedAt: l.scrapedAt,
    }));
  }

  toVCard(leads: Awaited<ReturnType<typeof this.getLeads>>): string {
    return leads
      .filter((l) => l.phone || l.email)
      .map((l) => {
        const lines = [
          "BEGIN:VCARD",
          "VERSION:3.0",
          `FN:${l.name}`,
          l.phone ? `TEL;TYPE=WORK:${l.phone}` : null,
          l.whatsapp && l.whatsapp !== l.phone ? `TEL;TYPE=CELL:${l.whatsapp}` : null,
          l.email ? `EMAIL;TYPE=WORK:${l.email}` : null,
          l.address ? `ADR;TYPE=WORK:;;${l.address};;;;` : null,
          l.website ? `URL:${l.website.startsWith("http") ? l.website : `https://${l.website}`}` : null,
          `NOTE:Score: ${l.score} | Priority: ${l.priority} | CRM: ${l.crmStatus}`,
          "END:VCARD",
        ];
        return lines.filter(Boolean).join("\r\n");
      })
      .join("\r\n");
  }
}
