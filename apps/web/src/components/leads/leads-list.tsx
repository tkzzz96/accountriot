"use client";
import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download } from "lucide-react";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "./leads-table";
import { api } from "@/lib/api";

export function LeadsList() {
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");
  const [crmStatus, setCrmStatus] = useState("all");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [siteStatus, setSiteStatus] = useState("all");
  const [stage, setStage] = useState("all");
  const [minScore, setMinScore] = useState("all");

  const { leads, total, loading } = useLeads({
    q: debouncedQ || undefined,
    priority: priority !== "all" ? priority : undefined,
    status: crmStatus !== "all" ? crmStatus : undefined,
    siteStatus: siteStatus !== "all" ? siteStatus : undefined,
    stage: stage !== "all" ? stage : undefined,
    minScore: minScore !== "all" ? Number(minScore) : undefined,
  });

  // Debounce the search box (the previous version leaked one timer per keystroke).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(search), 350);
    return () => clearTimeout(id);
  }, [search]);
  const handleSearch = setSearch;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar leads..." aria-label="Buscar leads"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="HIGH">Alta</SelectItem>
            <SelectItem value="MEDIUM">Média</SelectItem>
            <SelectItem value="LOW">Baixa</SelectItem>
          </SelectContent>
        </Select>
        <Select value={siteStatus} onValueChange={setSiteStatus}>
          <SelectTrigger className="w-40" aria-label="Situação do site"><SelectValue placeholder="Site" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sites</SelectItem>
            <SelectItem value="NONE">Sem site</SelectItem>
            <SelectItem value="SOCIAL_ONLY">Só rede social</SelectItem>
            <SelectItem value="FREE_BUILDER">Site gratuito</SelectItem>
            <SelectItem value="DEAD">Site fora do ar</SelectItem>
            <SelectItem value="HAS_SITE">Tem site</SelectItem>
            <SelectItem value="UNKNOWN">Não confirmado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="w-36" aria-label="Score mínimo"><SelectValue placeholder="Score" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer score</SelectItem>
            <SelectItem value="70">Quentes (70+)</SelectItem>
            <SelectItem value="45">Mornos (45+)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-40" aria-label="Etapa do pipeline"><SelectValue placeholder="Etapa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as etapas</SelectItem>
            <SelectItem value="READY">Prontos</SelectItem>
            <SelectItem value="FAILED">Com falha</SelectItem>
            <SelectItem value="CLASSIFIED">Em processamento</SelectItem>
          </SelectContent>
        </Select>
        <Select value={crmStatus} onValueChange={setCrmStatus}>
          <SelectTrigger className="w-36"><SelectValue placeholder="CRM Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="lost">Lost</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          {!loading && <span className="text-xs text-muted-foreground">{total} leads</span>}
          <Button variant="outline" onClick={() => api.download("/export/leads/csv", "leads-all.csv")}>
            <Download className="mr-2 h-4 w-4" />Exportar CSV
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <LeadsTable leads={leads} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
