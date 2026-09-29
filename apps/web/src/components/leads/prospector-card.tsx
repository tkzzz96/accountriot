"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Copy, ExternalLink, Loader2, MessageCircle, Mail, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Lead } from "@/hooks/use-leads";

const SITE_LABEL: Record<string, { label: string; tone: "success" | "warning" | "info" | "secondary" }> = {
  NONE: { label: "Sem site", tone: "success" },
  SOCIAL_ONLY: { label: "Só rede social", tone: "success" },
  FREE_BUILDER: { label: "Site gratuito", tone: "warning" },
  DEAD: { label: "Site fora do ar", tone: "warning" },
  HAS_SITE: { label: "Tem site", tone: "info" },
  UNKNOWN: { label: "Não confirmado", tone: "secondary" },
};

const STAGE_LABEL: Record<string, string> = {
  DISCOVERED: "Descoberto", CLASSIFIED: "Classificado", ENRICHED: "Enriquecido",
  SCORED: "Pontuado", DRAFTED: "Rascunho pronto", READY: "Pronto", FAILED: "Falhou",
};

export function waLink(e164: string | null | undefined, text: string): string | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}
export function mailtoLink(email: string | null | undefined, subject: string, body: string): string | null {
  return email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
}

export function ProspectorCard({ lead, onChange }: { lead: Lead; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!lead.siteStatus && !lead.pipelineStage) return null;

  const site = SITE_LABEL[lead.siteStatus ?? "UNKNOWN"];
  const mc = lead.marketingContent;
  const draft = mc?.text ? mc : null;
  const breakdown = lead.aiAnalysis?.score?.breakdown ?? [];
  const contacts = lead.aiAnalysis?.enrichment?.contacts ?? [];
  const wa = draft?.channel === "whatsapp" ? waLink(lead.whatsapp ?? lead.phone, draft.text!) : null;
  const mail = draft?.channel === "email" ? mailtoLink(lead.email, draft.subject ?? "", draft.text!) : null;

  const regenerate = async (channel?: "whatsapp" | "email") => {
    setBusy(true);
    try {
      await api.post(`/leads/${lead.id}/draft`, channel ? { channel } : {});
      onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card data-testid="prospector-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-base">Prospecção</CardTitle>
          <Badge variant={site.tone} data-testid="site-status">{site.label}</Badge>
          {lead.pipelineStage && <Badge variant="secondary">{STAGE_LABEL[lead.pipelineStage]}</Badge>}
          {lead.aiAnalysis?.score && <Badge variant={lead.aiAnalysis.score.tier === "HOT" ? "success" : "secondary"}>{lead.aiAnalysis.score.tier}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        {lead.pipelineError && <p className="text-destructive">Falha: {lead.pipelineError}</p>}

        <section>
          <h4 className="font-medium mb-1">Por que classificamos assim</h4>
          <p className="text-muted-foreground">{lead.siteEvidence?.reason ?? "—"}</p>
          <p className="text-xs text-muted-foreground mt-1 break-all">
            {lead.siteEvidence?.url ?? "sem URL"} · HTTP {lead.siteEvidence?.httpStatus ?? "n/d"} · DNS {lead.siteEvidence?.dnsOk == null ? "n/d" : lead.siteEvidence.dnsOk ? "ok" : "falhou"}
          </p>
        </section>

        <section>
          <h4 className="font-medium mb-1">Contato <span className="text-xs font-normal text-muted-foreground">({lead.ownerContactType === "OWNER" ? "dono" : lead.ownerContactType === "BUSINESS" ? "contato do negócio" : "origem incerta"})</span></h4>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground">Nenhum contato público encontrado.</p>
          ) : (
            <ul className="space-y-1">
              {contacts.map((c, i) => (
                <li key={i} className="flex flex-wrap gap-x-2">
                  <span className="font-mono">{c.value}</span>
                  <span className="text-xs text-muted-foreground">{c.type}{c.verified ? ` · ${c.verified}` : ""} · origem: {c.source}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h4 className="font-medium mb-1">Score {lead.score} · orçamento <span data-testid="budget-label">{lead.budgetSignals?.label ?? "n/d"}</span> ({lead.budgetScore ?? 0}/100)</h4>
          <ul className="space-y-0.5">
            {breakdown.map((b) => (
              <li key={b.key} className="flex justify-between gap-3 text-xs">
                <span>{b.label} <span className="text-muted-foreground">— {b.reason}</span></span>
                <span className="font-mono">{b.points}/{b.max}</span>
              </li>
            ))}
          </ul>
          {lead.budgetSignals && <p className="text-xs text-muted-foreground mt-1">{lead.budgetSignals.disclaimer}</p>}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium">Rascunho de follow-up</h4>
            {draft && <Badge variant="secondary">rascunho · nada é enviado</Badge>}
          </div>
          {draft ? (
            <>
              {draft.subject && <p className="text-muted-foreground mb-1">Assunto: {draft.subject}</p>}
              <p data-testid="draft-text" className="whitespace-pre-wrap rounded-md bg-muted/50 p-3">{draft.text}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(draft.text!)}><Copy className="w-3 h-3 mr-1" />Copiar</Button>
                {wa && <Button size="sm" variant="outline" asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="w-3 h-3 mr-1" />Abrir no WhatsApp</a></Button>}
                {mail && <Button size="sm" variant="outline" asChild><a href={mail}><Mail className="w-3 h-3 mr-1" />Abrir e-mail</a></Button>}
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => regenerate()}>{busy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}Regerar</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => regenerate(draft.channel === "whatsapp" ? "email" : "whatsapp")}>Versão {draft.channel === "whatsapp" ? "e-mail" : "WhatsApp"}</Button>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">Ainda sem rascunho.</p>
          )}
        </section>

        <section>
          <h4 className="font-medium mb-2">Referências de site do nicho</h4>
          {lead.references && lead.references.length > 0 ? (
            <div className="grid grid-cols-3 gap-3" data-testid="references">
              {lead.references.map((r) => (
                <a key={r.url} href={r.url} target="_blank" rel="noreferrer" className="group block rounded-md border overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={r.thumbUrl} alt={r.title} loading="lazy" referrerPolicy="no-referrer" className="aspect-video w-full object-cover bg-muted" />
                  <div className="p-2 text-xs flex items-center justify-between gap-1">
                    <span className="truncate">{r.title}</span><ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60" />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">Sem referências ainda.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
