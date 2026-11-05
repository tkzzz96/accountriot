"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useOpsStats } from "@/hooks/use-ops";
import { CRM_META, SITE_META, SITE_STATUSES, type CrmStatus } from "@/lib/lead-meta";

interface Overview {
  totalLeads: number;
  activeCampaigns: number;
  conversionRate: string;
  dealsWon: number;
  crmPipeline: Array<{ status: string; count: number }>;
}

interface IndustryRow {
  category: string | null;
  _count: { id: number };
  _avg: { score: number | null };
}

const CRM_COLORS: Record<string, string> = {
  new: "hsl(var(--muted-foreground))",
  contacted: "hsl(var(--info))",
  replied: "hsl(var(--primary))",
  meeting: "hsl(280 85% 65%)",
  proposal: "hsl(var(--warning))",
  won: "hsl(var(--success))",
  lost: "hsl(var(--destructive))",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export function AnalyticsDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [industries, setIndustries] = useState<IndustryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { t } = useI18n();
  const { stats: ops } = useOpsStats();

  useEffect(() => {
    Promise.all([
      api.get<Overview>("/analytics"),
      api.get<IndustryRow[]>("/analytics/industries"),
    ]).then(([ov, ind]) => {
      setOverview(ov);
      setIndustries(ind);
    }).catch((e) => { console.error("analytics", e); setError(true); }).finally(() => setLoading(false));
  }, []);

  const funnelData = (overview?.crmPipeline ?? []).map((item) => ({
    name: CRM_META[item.status as CrmStatus] ? t(CRM_META[item.status as CrmStatus].key) : item.status,
    value: item.count,
    color: CRM_COLORS[item.status] ?? "#94a3b8",
  }));

  const industryData = industries
    .filter((r) => r.category)
    .slice(0, 8)
    .map((r) => ({
      name: r.category!,
      leads: r._count.id,
      avgScore: Math.round(r._avg.score ?? 0),
    }));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-7 w-16" />
                <Skeleton className="h-3.5 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardContent className="pt-6">
              <Skeleton className="h-[240px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <Skeleton className="h-[200px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stats = [
    { label: t("dash.totalLeads"), value: overview?.totalLeads.toLocaleString() ?? "0" },
    { label: t("dash.conversionRate"), value: overview?.conversionRate ?? "0%" },
    { label: t("dash.dealsWon"), value: overview?.dealsWon.toString() ?? "0" },
    { label: t("dash.activeCampaigns"), value: overview?.activeCampaigns.toString() ?? "0" },
  ];
  const siteTotal = SITE_STATUSES.reduce((n, k) => n + (ops?.leadsBySiteStatus[k] ?? 0), 0);

  return (
    <div className="space-y-6">
      {error && <p role="alert" className="text-sm text-destructive">{t("an.loadError")}</p>}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card interactive className="h-full">
              <CardContent className="pt-6">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{stat.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("an.byIndustry")}</CardTitle>
          </CardHeader>
          <CardContent>
            {industryData.length === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                {t("an.noIndustry")}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={industryData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="leads" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t("an.seriesLeads")} />
                  <Bar dataKey="avgScore" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name={t("an.seriesAvg")} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("an.funnel")}</CardTitle>
          </CardHeader>
          <CardContent>
            {funnelData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center">
                {t("an.noLeads")}
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-3">
                  <PieChart width={160} height={160}>
                    <Pie
                      data={funnelData}
                      cx={75} cy={75}
                      innerRadius={45} outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {funnelData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </div>
                <div className="space-y-2">
                  {funnelData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-semibold">{item.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {siteTotal > 0 && (
        <Card data-testid="site-status-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("an.siteStatus")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("an.siteStatusHint")}</p>
          </CardHeader>
          <CardContent className="space-y-2">
            {SITE_STATUSES.map((k) => {
              const n = ops?.leadsBySiteStatus[k] ?? 0;
              return (
                <div key={k} className="flex items-center gap-3 text-sm">
                  <span className="w-36 text-muted-foreground">{t(SITE_META[k].key)}</span>
                  <div className="h-2 flex-1 rounded bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.round((n / siteTotal) * 100)}%` }} />
                  </div>
                  <span className="w-10 text-right font-semibold">{n}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {funnelData.length === 0 && industryData.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground text-sm">
              {t("an.empty")}
            </p>
            <Badge variant="secondary" className="mt-3">
              {t("an.emptyCta")}
            </Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
