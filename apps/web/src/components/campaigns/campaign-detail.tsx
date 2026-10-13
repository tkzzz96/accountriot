"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AlertTriangle, ArrowLeft, Download, Users, Star, TrendingUp, MapPin, Loader2, List, Map as MapIcon } from "lucide-react";
import { useCampaign } from "@/hooks/use-campaigns";
import { useLeads } from "@/hooks/use-leads";
import { LeadsTable } from "@/components/leads/leads-table";
import { api } from "@/lib/api";

const LeadsMap = dynamic(() => import("@/components/leads/leads-map").then((m) => m.LeadsMap), {
  ssr: false,
  loading: () => <div className="h-[520px] w-full animate-pulse bg-muted" />,
});

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function CampaignDetail({ id }: { id: string }) {
  const { campaign, loading, refresh } = useCampaign(id);
  const [siteFilter, setSiteFilter] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const { leads, total, loading: leadsLoading, refresh: refreshLeads } = useLeads({
    campaignId: id,
    limit: 200,
    siteStatus: siteFilter !== "all" ? siteFilter : undefined,
    minScore: scoreFilter !== "all" ? Number(scoreFilter) : undefined,
  });
  const { leads: failedLeads, refresh: refreshFailed } = useLeads({ campaignId: id, stage: "FAILED", limit: 200 });
  const [retrying, setRetrying] = useState(false);

  // Poll while campaign is running
  useEffect(() => {
    if (campaign?.status !== "running") return;
    const interval = setInterval(async () => {
      await refresh();
      await refreshLeads();
      await refreshFailed();
    }, 4000);
    return () => clearInterval(interval);
  }, [campaign?.status, refresh, refreshLeads, refreshFailed]);

  const retryFailed = async () => {
    setRetrying(true);
    try {
      await Promise.all(failedLeads.map((l) => api.post(`/leads/${l.id}/retry`, {})));
      await refresh();
      await refreshFailed();
    } finally {
      setRetrying(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-3.5 w-1/2" />
          </div>
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-4 pb-4 space-y-2">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-7 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }
  if (!campaign) {
    return <div className="text-center py-20 text-muted-foreground">Campanha não encontrada</div>;
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item} className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/campaigns"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold truncate">{campaign.name}</h1>
            {campaign.status === "completed" && <Badge variant="success">Completed</Badge>}
            {campaign.status === "failed" && <Badge variant="destructive">Falhou</Badge>}
            {campaign.status === "running" && (
              <Badge variant="info" className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />{campaign.progress}%
              </Badge>
            )}
            {campaign.status === "draft" && <Badge variant="secondary">Rascunho</Badge>}
          </div>
          <p className="text-muted-foreground text-sm capitalize">{campaign.industry} · {campaign.location}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/csv?campaignId=${id}`, `leads-${id}.csv`)}>
            <Download className="mr-2 h-4 w-4" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/json?campaignId=${id}`, `leads-${id}.json`)}>
            <Download className="mr-2 h-4 w-4" />JSON
          </Button>
          <Button variant="outline" size="sm" onClick={() => api.download(`/export/leads/vcard?campaignId=${id}`, `leads-${id}.vcf`)}>
            <Download className="mr-2 h-4 w-4" />vCard
          </Button>
        </div>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total de leads", value: campaign.totalLeads, icon: Users, color: "text-info" },
          { label: "Prioridade alta", value: campaign.priorityLeads, icon: Star, color: "text-warning" },
          { label: "Alta qualidade (70+)", value: campaign.highQualityLeads, icon: TrendingUp, color: "text-success" },
          { label: "Score médio", value: campaign.averageScore || "—", icon: MapPin, color: "text-primary" },
        ].map((s) => (
          <Card key={s.label} interactive>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="text-2xl font-bold">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      {campaign.status === "running" && (
        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-info" />Buscando, classificando e preparando os leads...
                </span>
                <span className="font-medium">{campaign.progress}%</span>
              </div>
              <Progress value={campaign.progress} className="h-2" />
            </CardContent>
          </Card>
        </motion.div>
      )}

      {campaign.status === "failed" && campaign.error && (
        <motion.div variants={item}>
          <Card className="border-destructive/50">
            <CardContent className="pt-4 flex items-start gap-2 text-sm text-destructive" role="alert">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>A campanha falhou: {campaign.error}</span>
            </CardContent>
          </Card>
        </motion.div>
      )}
      {failedLeads.length > 0 && (
        <motion.div variants={item}>
          <Card className="border-warning/50">
            <CardContent className="pt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" />{failedLeads.length} lead(s) falharam no processamento.</span>
              <Button size="sm" variant="outline" disabled={retrying} onClick={retryFailed}>
                {retrying && <Loader2 className="mr-1 w-3 h-3 animate-spin" />}Tentar novamente
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
      {campaign.status === "completed" && campaign.totalLeads === 0 && total === 0 && (
        <motion.div variants={item}>
          <Card>
            <CardContent className="pt-4 text-sm text-muted-foreground">
              Nenhum lead novo foi encontrado. Pode ser que todos já estejam no seu CRM (a deduplicação ignora repetidos), que o filtro
              &ldquo;somente sem site&rdquo; tenha descartado todos, ou que a busca tenha vindo vazia. Tente ampliar o raio ou mudar o nicho.
            </CardContent>
          </Card>
        </motion.div>
      )}

      <motion.div variants={item}>
        <Card>
          <Tabs defaultValue="list">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Leads ({total})</CardTitle>
                <div className="flex items-center gap-2">
                  <TabsList>
                    <TabsTrigger value="list" className="text-xs">
                      <List className="mr-1 w-3 h-3" />Lista
                    </TabsTrigger>
                    <TabsTrigger value="map" className="text-xs">
                      <MapIcon className="mr-1 w-3 h-3" />Mapa
                    </TabsTrigger>
                  </TabsList>
                  <Select value={siteFilter} onValueChange={setSiteFilter}>
                    <SelectTrigger className="h-8 w-36 text-xs" aria-label="Filtrar por situação do site"><SelectValue placeholder="Site" /></SelectTrigger>
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
                  <Select value={scoreFilter} onValueChange={setScoreFilter}>
                    <SelectTrigger className="h-8 w-32 text-xs" aria-label="Filtrar por score"><SelectValue placeholder="Score" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Qualquer score</SelectItem>
                      <SelectItem value="70">Quentes (70+)</SelectItem>
                      <SelectItem value="45">Mornos (45+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <TabsContent value="list" className="mt-0">
              <CardContent className="p-0">
                <LeadsTable leads={leads} loading={leadsLoading} />
              </CardContent>
            </TabsContent>
            <TabsContent value="map" className="mt-0">
              <CardContent className="p-0">
                {leadsLoading ? (
                  <div className="h-[520px] w-full animate-pulse bg-muted" />
                ) : (
                  <LeadsMap leads={leads} />
                )}
              </CardContent>
            </TabsContent>
          </Tabs>
        </Card>
      </motion.div>
    </motion.div>
  );
}
