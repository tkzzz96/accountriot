"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Phone, Globe, MapPin, Star, Loader2, Copy, Send, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useLead } from "@/hooks/use-leads";
import { ProspectorCard } from "./prospector-card";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { CRM_META, CRM_STATUSES, PRIORITY_META, type CrmStatus } from "@/lib/lead-meta";
import type { MessageKey } from "@/locales/pt-BR";

const ACTIVITY_KEY: Record<string, MessageKey> = {
  crm_update: "ld.act.crm_update", llm_draft: "ld.act.llm_draft", webhook_export: "ld.act.webhook_export",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function LeadDetail({ id }: { id: string }) {
  const { lead, loading, refresh } = useLead(id);
  const { t } = useI18n();
  const router = useRouter();
  const [crmStatus, setCrmStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // While the pipeline is still working on this lead, refresh until it reaches READY/FAILED.
  const stage = lead?.pipelineStage;
  useEffect(() => {
    if (!stage || stage === "READY" || stage === "FAILED") return;
    const timer = setInterval(() => { void refresh(true); }, 3000);
    return () => clearInterval(timer);
  }, [stage, refresh]);

  const handleCrmUpdate = async () => {
    if (!crmStatus || !lead) return;
    setSaving(true);
    try {
      await api.patch(`/leads/${id}/crm`, { crmStatus });
      toast.success(t("ld.statusUpdated"));
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = async () => {
    if (notes == null) return;
    setBusy(true);
    try {
      await api.patch(`/leads/${id}/crm`, { crmNotes: notes });
      toast.success(t("ld.notesSaved"));
      await refresh(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const exportWebhook = async () => {
    setBusy(true);
    try {
      await api.post(`/leads/${id}/export/webhook`);
      toast.success(t("ld.exportWebhookDone"));
      await refresh(true);
    } catch (e) {
      const status = (e as { status?: number }).status;
      toast.error(status === 503 ? t("ld.exportWebhookOff") : e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const removeLead = async () => {
    if (!lead || !window.confirm(t("ld.deleteConfirm", { name: lead.name }))) return;
    setBusy(true);
    try {
      await api.delete(`/leads/${id}`);
      toast.success(t("ld.deleted"));
      router.push("/leads");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-4 w-3/4" />
                ))}
              </CardContent>
            </Card>
          </div>
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }
  if (!lead) {
    return <div className="text-center py-20 text-muted-foreground">{t("ld.notFound")}</div>;
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-4xl"
    >
      <motion.div variants={item} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/leads" aria-label={t("ld.back")}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold">{lead.name}</h1>
            {lead.priority === "HIGH" && <Badge variant="success">{t(PRIORITY_META.HIGH.key)}</Badge>}
            {lead.hasWebsite && <Badge variant="info">{t("ld.hasWebsite")}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{[lead.category, lead.address].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-2xl font-bold text-primary">{lead.score}</div>
          <div className="text-xs text-muted-foreground">{t("score.label")}</div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div variants={item} className="lg:col-span-2 space-y-4">
          <ProspectorCard lead={lead} onChange={() => { void refresh(true); }} />
          {/* Contact Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("ld.contactInfo")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Phone, label: t("ld.phone"), value: lead.phone },
                { icon: Globe, label: t("ld.website"), value: lead.website },
                { icon: MapPin, label: t("ld.address"), value: lead.address },
                { icon: Star, label: t("ld.rating"), value: lead.rating ? t("ld.ratingValue", { rating: lead.rating }) : undefined },
              ]
                .filter((i) => i.value)
                .map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm flex-1 break-all">{item.value}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-40 hover:opacity-100 flex-shrink-0"
                      aria-label={`${t("common.copy")} ${item.label}`}
                      onClick={() => { void navigator.clipboard.writeText(item.value!).then(() => toast.success(t("common.copied"))); }}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
            </CardContent>
          </Card>

        </motion.div>

        {/* CRM Panel */}
        <motion.div variants={item} className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("ld.crmTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select
                defaultValue={lead.crmStatus}
                onValueChange={(v) => setCrmStatus(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CRM_STATUSES.map((c) => <SelectItem key={c} value={c}>{t(CRM_META[c as CrmStatus].key)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button
                variant="gradient"
                className="w-full text-sm h-9"
                onClick={handleCrmUpdate}
                disabled={saving || !crmStatus}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("ld.updateStatus")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("ld.notes")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                rows={3}
                maxLength={2000}
                aria-label={t("ld.notes")}
                placeholder={t("ld.notesPlaceholder")}
                value={notes ?? lead.crmNotes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
              />
              <Button variant="outline" size="sm" className="w-full" disabled={busy || notes == null} onClick={saveNotes}>{t("ld.saveNotes")}</Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full" disabled={busy} onClick={exportWebhook} data-testid="export-webhook">
                <Send className="mr-2 h-3.5 w-3.5" />{t("ld.exportWebhook")}
              </Button>
              <Button variant="outline" size="sm" className="w-full text-destructive" disabled={busy} onClick={removeLead} data-testid="delete-lead">
                <Trash2 className="mr-2 h-3.5 w-3.5" />{t("ld.delete")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{t("ld.activity")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(lead.activities || []).map((a) => (
                  <div key={a.id} className="text-xs border-l-2 border-primary/30 pl-3">
                    <p className="font-medium text-muted-foreground">{ACTIVITY_KEY[a.type] ? t(ACTIVITY_KEY[a.type]) : a.type}</p>
                    <p className="mt-0.5">{a.note}</p>
                  </div>
                ))}
                {(!lead.activities || lead.activities.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("ld.noActivity")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
