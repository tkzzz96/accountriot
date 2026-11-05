"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Loader2, MessageCircle, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BUDGET_DISCLAIMER, BUDGET_LABEL_KEY, EVIDENCE_KEY, SITE_META, STAGE_KEY } from "@/lib/lead-meta";
import type { Lead } from "@/hooks/use-leads";

/** Only http(s) links are rendered as clickable (data may originate from third-party listings). */
export function safeHref(url: string | null | undefined): string | undefined {
  try {
    const u = new URL(url ?? "");
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function waLink(e164: string | null | undefined, text: string): string | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
export function mailtoLink(email: string | null | undefined, subject: string, body: string): string | null {
  return email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
}

export function ProspectorCard({ lead, onChange }: { lead: Lead; onChange: () => void }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  if (!lead.siteStatus && !lead.pipelineStage) return null;

  const site = SITE_META[lead.siteStatus ?? "UNKNOWN"];
  const evidenceKey = lead.siteEvidence?.code ? EVIDENCE_KEY[lead.siteEvidence.code] : undefined;
  const mc = lead.marketingContent;
  const draft = mc?.text ? mc : null;
  const breakdown = lead.aiAnalysis?.score?.breakdown ?? [];
  const contacts = lead.aiAnalysis?.enrichment?.contacts ?? [];
  const wa = draft?.channel === "whatsapp" ? waLink(lead.whatsapp ?? lead.phone, draft.text!) : null;
  const mail = draft?.channel === "email" ? mailtoLink(lead.email, draft.subject ?? "", draft.text!) : null;

  const retry = async () => {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/retry`, {});
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pc.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async (channel?: "whatsapp" | "email") => {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/draft`, channel ? { channel } : {});
      onChange();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("pc.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="prospector-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base">{t("pc.title")}</CardTitle>
          <Badge variant={site.tone} data-testid="site-status">{t(site.key)}</Badge>
          {lead.pipelineStage && <Badge variant="secondary">{t(STAGE_KEY[lead.pipelineStage])}</Badge>}
          {lead.aiAnalysis?.score && <Badge variant={lead.aiAnalysis.score.tier === "HOT" ? "success" : "secondary"}>{lead.aiAnalysis.score.tier}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {lead.pipelineError && (
          <div className="flex flex-wrap items-center gap-2 text-destructive" role="alert">
            <span>{t("pc.failedPrefix", { error: lead.pipelineError })}</span>
            <Button size="sm" variant="outline" disabled={busy} onClick={retry}>{t("common.retry")}</Button>
          </div>
        )}

        <section>
          <h4 className="font-medium mb-1">{t("pc.whyTitle")}</h4>
          <p className="text-muted-foreground">{evidenceKey ? t(evidenceKey) : lead.siteEvidence?.reason || "—"}</p>
          <p className="text-xs text-muted-foreground mt-1 break-all">
            {lead.siteEvidence?.url ?? t("pc.noUrl")} · HTTP {lead.siteEvidence?.httpStatus ?? t("pc.na")} · DNS {lead.siteEvidence?.dnsOk == null ? t("pc.na") : lead.siteEvidence.dnsOk ? t("pc.dnsOk") : t("pc.dnsFail")}
          </p>
        </section>

        <section>
          <h4 className="font-medium mb-1">{t("pc.contact")} <span className="text-xs font-normal text-muted-foreground">({lead.ownerContactType === "OWNER" ? t("pc.owner") : lead.ownerContactType === "BUSINESS" ? t("pc.business") : t("pc.unknownOrigin")})</span></h4>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground">{t("pc.noContacts")}</p>
          ) : (
            <ul className="space-y-1">
              {contacts.map((c, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-mono">{c.value}</span>
                  <span className="text-xs text-muted-foreground">{c.type}{c.verified ? ` · ${c.verified}` : ""} · {t("pc.contactSource", { source: c.source })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="font-medium mb-1">{t("pc.scoreLine", { score: lead.score })} <span data-testid="budget-label">{lead.budgetSignals ? (BUDGET_LABEL_KEY[lead.budgetSignals.label] ? t(BUDGET_LABEL_KEY[lead.budgetSignals.label]) : lead.budgetSignals.label) : t("pc.na")}</span> ({lead.budgetScore ?? 0}/100)</h4>
          <ul className="space-y-0.5">
            {breakdown.map((b) => (
              <li key={b.key} className="flex justify-between gap-3 text-xs">
                <span>{b.label} <span className="text-muted-foreground">— {b.reason}</span></span>
                <span className="font-mono">{b.points}/{b.max}</span>
              </li>
            ))}
          </ul>
          {lead.budgetSignals && <p className="text-xs text-muted-foreground mt-1">{lead.budgetSignals.disclaimer === BUDGET_DISCLAIMER ? t("budget.disclaimer") : lead.budgetSignals.disclaimer}</p>}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">{t("pc.draftTitle")}</h4>
            {draft && <Badge variant="secondary">{t("pc.draftBadge")}</Badge>}
            {draft?.generator && <span className="text-xs text-muted-foreground">{t("pc.generatedBy", { by: draft.generator === "llm" ? t("pc.byLlm") : t("pc.byTemplate") })}</span>}
          </div>
          {draft ? (
            <>
              {draft.subject && <p className="text-muted-foreground mb-1">{t("pc.subject", { subject: draft.subject })}</p>}
              <p data-testid="draft-text" className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{draft.text}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => { void navigator.clipboard.writeText(draft.text!).then(() => toast.success(t("common.copied"))); }}><Copy className="w-3 h-3 mr-1" />{t("common.copy")}</Button>
                {wa && <Button size="sm" variant="outline" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="w-3 h-3 mr-1" />{t("pc.openWhatsapp")}</a></Button>}
                {mail && <Button size="sm" variant="outline" asChild><a href={mail}><Mail className="w-3 h-3 mr-1" />{t("pc.openEmail")}</a></Button>}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => regenerate()}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}{t("pc.regenerate")}</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => regenerate(draft.channel === "whatsapp" ? "email" : "whatsapp")}>{draft.channel === "whatsapp" ? t("pc.versionEmail") : t("pc.versionWhatsapp")}</Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("pc.noDraft")}</p>
          )}
        </section>

        <section>
          <h4 className="font-medium mb-2">{t("pc.refsTitle")}</h4>
          {lead.references && lead.references.length > 0 ? (
            <div className="grid grid-cols-3 gap-3" data-testid="references">
              {lead.references.filter((r) => safeHref(r.url)).map((r) => (
                <a key={r.url} href={safeHref(r.url)} target="_blank" rel="noreferrer" className="group block rounded-md border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={safeHref(r.thumbUrl) ?? ""} alt={t("pc.refAlt", { title: r.title })} loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full object-cover bg-muted" />
                  <div className="p-2 text-xs flex items-center justify-between gap-1">
                    <span className="truncate">{r.title}</span><ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">{t("pc.noRefs")}</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
