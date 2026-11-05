"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLeads, type Lead } from "@/hooks/use-leads";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CRM_META, CRM_STATUSES, SITE_META, type CrmStatus } from "@/lib/lead-meta";

const LIMIT = 200;

/** CRM board: one column per status. Cards are draggable (mouse) and also have a "move to" select (keyboard/touch). */
export function Kanban() {
  const { t } = useI18n();
  const { leads, total, loading, error } = useLeads({ limit: LIMIT });
  const [items, setItems] = useState<Lead[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<CrmStatus | null>(null);

  useEffect(() => setItems(leads), [leads]);

  const move = async (lead: Lead, status: CrmStatus) => {
    if (lead.crmStatus === status) return;
    const previous = lead.crmStatus;
    setItems((cur) => cur.map((l) => (l.id === lead.id ? { ...l, crmStatus: status } : l)));
    try {
      await api.patch(`/leads/${lead.id}/crm`, { crmStatus: status });
      toast.success(t("kanban.moved", { name: lead.name, status: t(CRM_META[status].key) }));
    } catch {
      setItems((cur) => cur.map((l) => (l.id === lead.id ? { ...l, crmStatus: previous } : l)));
      toast.error(t("kanban.moveFailed"));
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {CRM_STATUSES.map((s) => <Skeleton key={s} className="h-64" />)}
      </div>
    );
  }
  if (error) return <p role="alert" className="text-sm text-destructive">{t("leads.loadError")}</p>;

  return (
    <div className="space-y-3">
      {total > LIMIT && <p className="text-xs text-muted-foreground">{t("kanban.truncated", { n: LIMIT })}</p>}
      <div className="flex gap-3 overflow-x-auto pb-3" role="list" aria-label={t("kanban.board")} data-testid="kanban">
        {CRM_STATUSES.map((status) => {
          const col = items.filter((l) => l.crmStatus === status);
          return (
            <section
              key={status}
              role="listitem"
              data-testid={`col-${status}`}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                setOverCol(null);
                const lead = items.find((l) => l.id === (dragId ?? e.dataTransfer.getData("text/plain")));
                setDragId(null);
                if (lead) void move(lead, status);
              }}
              className={`w-64 flex-shrink-0 rounded-lg border bg-muted/30 p-2 transition-colors ${overCol === status ? "border-primary bg-primary/5" : ""}`}
            >
              <header className="mb-2 flex items-center justify-between px-1">
                <Badge variant={CRM_META[status].tone}>{t(CRM_META[status].key)}</Badge>
                <span className="text-xs text-muted-foreground">{col.length}</span>
              </header>
              <div className="space-y-2 min-h-[4rem]">
                {col.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">{overCol === status ? t("kanban.drop") : t("kanban.empty")}</p>}
                {col.map((lead) => (
                  <article
                    key={lead.id}
                    data-testid="kanban-card"
                    draggable
                    onDragStart={(e) => { setDragId(lead.id); e.dataTransfer.setData("text/plain", lead.id); e.dataTransfer.effectAllowed = "move"; }}
                    onDragEnd={() => { setDragId(null); setOverCol(null); }}
                    className="cursor-grab rounded-md border bg-card p-2.5 text-sm shadow-sm active:cursor-grabbing"
                  >
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline line-clamp-2">{lead.name}</Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {lead.siteStatus && SITE_META[lead.siteStatus] && <Badge variant={SITE_META[lead.siteStatus].tone} className="text-[10px] py-0">{t(SITE_META[lead.siteStatus].key)}</Badge>}
                      <span className="text-xs font-semibold text-primary">{lead.score}</span>
                    </div>
                    <Select value={lead.crmStatus} onValueChange={(v) => void move(lead, v as CrmStatus)}>
                      <SelectTrigger className="mt-2 h-7 text-xs" aria-label={t("kanban.moveTo", { name: lead.name })}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CRM_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(CRM_META[s].key)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
