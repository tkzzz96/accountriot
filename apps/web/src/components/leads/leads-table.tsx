"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, Globe, MapPin, Star, ChevronRight, Users } from "lucide-react";
import type { Lead } from "@/hooks/use-leads";
import { useI18n } from "@/lib/i18n";
import { CRM_META, PRIORITY_META, SITE_META, STAGE_KEY, type CrmStatus } from "@/lib/lead-meta";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0 },
};

interface Props {
  leads: Lead[];
  loading: boolean;
  /** When provided, rows get a checkbox and the header gets a "select all". */
  selected?: Set<string>;
  onSelectedChange?: (next: Set<string>) => void;
}

export function LeadsTable({ leads, loading, selected, onSelectedChange }: Props) {
  const { t } = useI18n();
  const selectable = Boolean(selected && onSelectedChange);

  if (loading) {
    return (
      <div className="divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-3">
            <Skeleton className="w-9 h-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-10 hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }
  if (leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <div className="p-3 rounded-full bg-muted">
          <Users className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">{t("leads.empty")}</p>
        <p className="text-xs text-muted-foreground">{t("leads.emptyHint")}</p>
      </div>
    );
  }

  const allSelected = selectable && leads.every((l) => selected!.has(l.id));
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange!(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) leads.forEach((l) => next.delete(l.id));
    else leads.forEach((l) => next.add(l.id));
    onSelectedChange!(next);
  };

  return (
    <div>
      {selectable && (
        <div className="flex items-center gap-3 border-b px-6 py-2 text-xs text-muted-foreground">
          <input type="checkbox" aria-label={t("leads.selectAll")} data-testid="select-all" checked={allSelected} onChange={toggleAll} />
          <span>{t("leads.selectAll")}</span>
        </div>
      )}
      <motion.div variants={container} initial="hidden" animate="show" className="divide-y">
        {leads.map((lead) => {
          const site = SITE_META[lead.siteStatus ?? ""];
          const prio = PRIORITY_META[lead.priority] ?? PRIORITY_META.LOW;
          const crm = CRM_META[lead.crmStatus as CrmStatus] ?? CRM_META.new;
          return (
            <motion.div key={lead.id} variants={item} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
              {selectable && (
                <input
                  type="checkbox"
                  data-testid="select-lead"
                  aria-label={t("leads.select", { name: lead.name })}
                  checked={selected!.has(lead.id)}
                  onChange={() => toggle(lead.id)}
                />
              )}
              <div className="w-9 h-9 bg-gradient-brand rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">{lead.name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <span className="font-medium text-sm truncate">{lead.name}</span>
                  <Badge variant={prio.tone}>{t(prio.key)}</Badge>
                  {site && <Badge variant={site.tone}>{t(site.key)}</Badge>}
                  {lead.pipelineStage && lead.pipelineStage !== "READY" && (
                    <Badge variant={lead.pipelineStage === "FAILED" ? "destructive" : "secondary"}>{t(STAGE_KEY[lead.pipelineStage])}</Badge>
                  )}
                  <Badge variant={crm.tone}>{t(crm.key)}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {lead.address && (
                    <span className="flex items-center gap-1 truncate max-w-[200px]">
                      <MapPin className="w-3 h-3 flex-shrink-0" />{lead.address}
                    </span>
                  )}
                  {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                  {lead.website && <span className="flex items-center gap-1"><Globe className="w-3 h-3" />{lead.website}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                {lead.rating && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Star className="w-3 h-3 text-warning" />{lead.rating}
                    {lead.reviewCount != null && ` (${lead.reviewCount})`}
                  </span>
                )}
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-bold text-primary">{lead.score}</div>
                  <div className="text-[10px] text-muted-foreground">{t("score.label")}</div>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <Link href={`/leads/${lead.id}`} aria-label={t("leads.open", { name: lead.name })}><ChevronRight className="h-4 w-4" /></Link>
                </Button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
