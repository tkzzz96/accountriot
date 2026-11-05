"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Trash2 } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "./leads-table";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CRM_META, CRM_STATUSES, SITE_META, SITE_STATUSES, type CrmStatus } from "@/lib/lead-meta";

const PAGE_SIZE = 50;
const ACTIVE_STAGES = "DISCOVERED,CLASSIFIED,ENRICHED,SCORED,DRAFTED";

/** Filters live in the URL, so a filtered view can be bookmarked/shared and the header search (/leads?q=…) works. */
export function LeadsList() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const get = (k: string, d = "all") => params.get(k) || d;

  const [search, setSearch] = useState(params.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(params.get("q") ?? "");
  const priority = get("priority");
  const crmStatus = get("status");
  const siteStatus = get("siteStatus");
  const stageParam = get("stage");
  const minScore = get("minScore");
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params.toString());
    if (v == null || v === "all" || v === "") next.delete(k);
    else next.set(k, v);
    if (k !== "page") next.delete("page");
    router.replace(next.toString() ? `${pathname}?${next}` : pathname);
    setSelected(new Set());
  };

  // Debounce the search box and keep it in the URL.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search), 350);
    return () => clearTimeout(id);
  }, [search]);
  const lastQ = useRef(params.get("q") ?? "");
  useEffect(() => {
    if (debouncedQ === lastQ.current) return;
    lastQ.current = debouncedQ;
    setParam("q", debouncedQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ]);
  // The header search (or a link) navigates here with a new ?q=: sync the box, but never overwrite what the user is typing.
  useEffect(() => {
    const q = params.get("q") ?? "";
    if (q === lastQ.current) return;
    lastQ.current = q;
    setSearch(q);
    setDebouncedQ(q);
  }, [params]);

  const { leads, total, loading, error, refresh } = useLeads({
    q: debouncedQ || undefined,
    priority: priority !== "all" ? priority : undefined,
    status: crmStatus !== "all" ? crmStatus : undefined,
    siteStatus: siteStatus !== "all" ? siteStatus : undefined,
    stage: stageParam !== "all" ? (stageParam === "ACTIVE" ? ACTIVE_STAGES : stageParam) : undefined,
    minScore: minScore !== "all" ? Number(minScore) : undefined,
    page,
    limit: PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const bulkStatus = async (status: CrmStatus) => {
    try {
      const res = await api.post<{ affected: number }>("/leads/bulk", { ids: [...selected], action: "crm", crmStatus: status });
      toast.success(t("leads.bulkDone", { n: res.affected }));
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };
  const bulkDelete = async () => {
    if (!window.confirm(t("leads.bulkConfirm", { n: selected.size }))) return;
    try {
      const res = await api.post<{ affected: number }>("/leads/bulk", { ids: [...selected], action: "delete" });
      toast.success(t("leads.bulkDeleted", { n: res.affected }));
      setSelected(new Set());
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("leads.searchPlaceholder")} aria-label={t("leads.searchLabel")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priority} onValueChange={(v) => setParam("priority", v)}>
          <SelectTrigger className="w-40" aria-label={t("prio.label")}><SelectValue placeholder={t("prio.label")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("prio.all")}</SelectItem>
            <SelectItem value="HIGH">{t("prio.HIGH")}</SelectItem>
            <SelectItem value="MEDIUM">{t("prio.MEDIUM")}</SelectItem>
            <SelectItem value="LOW">{t("prio.LOW")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={siteStatus} onValueChange={(v) => setParam("siteStatus", v)}>
          <SelectTrigger className="w-40" aria-label={t("site.filterLabel")}><SelectValue placeholder={t("site.filterLabel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("site.allSites")}</SelectItem>
            {SITE_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(SITE_META[s].key)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={minScore} onValueChange={(v) => setParam("minScore", v)}>
          <SelectTrigger className="w-36" aria-label={t("score.minLabel")}><SelectValue placeholder={t("score.label")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("score.any")}</SelectItem>
            <SelectItem value="70">{t("score.hot")}</SelectItem>
            <SelectItem value="45">{t("score.warm")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stageParam} onValueChange={(v) => setParam("stage", v)}>
          <SelectTrigger className="w-40" aria-label={t("stage.filterLabel")}><SelectValue placeholder={t("stage.filterLabel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("stage.all")}</SelectItem>
            <SelectItem value="READY">{t("stage.ready")}</SelectItem>
            <SelectItem value="FAILED">{t("stage.failed")}</SelectItem>
            <SelectItem value="ACTIVE">{t("stage.active")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={crmStatus} onValueChange={(v) => setParam("status", v)}>
          <SelectTrigger className="w-40" aria-label={t("crm.statusLabel")}><SelectValue placeholder={t("crm.statusLabel")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("crm.allStatuses")}</SelectItem>
            {CRM_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(CRM_META[s].key)}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {!loading && <span className="text-xs text-muted-foreground">{t("leads.count", { n: total })}</span>}
          <Button variant="outline" onClick={() => api.download("/export/leads/csv", "leads-all.csv")}>
            <Download className="mr-2 h-4 w-4" />{t("leads.exportCsv")}
          </Button>
        </div>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t("leads.loadError")}</p>}

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm" data-testid="bulk-bar">
          <span>{t("leads.selected", { n: selected.size })}</span>
          <Select value="" onValueChange={(v) => void bulkStatus(v as CrmStatus)}>
            <SelectTrigger className="h-8 w-44 text-xs" aria-label={t("leads.bulkStatus")} data-testid="bulk-status"><SelectValue placeholder={t("leads.bulkStatus")} /></SelectTrigger>
            <SelectContent>
              {CRM_STATUSES.map((s) => <SelectItem key={s} value={s}>{t(CRM_META[s].key)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="text-destructive" onClick={bulkDelete} data-testid="bulk-delete">
            <Trash2 className="mr-1 h-3.5 w-3.5" />{t("leads.bulkDelete")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>{t("leads.clearSelection")}</Button>
        </div>
      )}

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <LeadsTable leads={leads} loading={loading} selected={selected} onSelectedChange={setSelected} />
        </CardContent>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setParam("page", String(page - 1))}>{t("leads.prev")}</Button>
          <span className="text-xs text-muted-foreground">{t("leads.page", { page, pages })}</span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setParam("page", String(page + 1))}>{t("leads.next")}</Button>
        </div>
      )}
    </div>
  );
}
