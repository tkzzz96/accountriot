"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Sparkles, Mail, Image as ImageIcon, Webhook, Layers, Zap, ArrowRight } from "lucide-react";
import { useOpsStats } from "@/hooks/use-ops";
import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/locales/pt-BR";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

function StatusCard(props: { icon: typeof Zap; title: MessageKey; desc: MessageKey; enabled: boolean; extra?: string; testId: string }) {
  const { t } = useI18n();
  return (
    <motion.div variants={item}>
      <Card className="h-full" data-testid={props.testId}>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0"><props.icon className="w-5 h-5 text-primary" /></div>
              <CardTitle className="text-sm">{t(props.title)}</CardTitle>
            </div>
            <Badge variant={props.enabled ? "success" : "secondary"} className="text-[10px] flex-shrink-0">{props.enabled ? t("int.on") : t("int.off")}</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-1">
          <CardDescription className="text-xs leading-relaxed">{t(props.desc)}</CardDescription>
          {props.extra && <p className="text-xs font-medium">{props.extra}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Real integration status, read from GET /ops/stats (what the API process actually has configured). */
export function IntegrationsPage() {
  const { t } = useI18n();
  const { stats, error } = useOpsStats(15_000);
  const apiRoot = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").replace(/\/api\/?$/, "");

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("integrations.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("integrations.subtitle")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings">{t("int.aiSettings")} <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{t("int.loadError")}</p>}

      {!stats && !error ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : stats ? (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StatusCard testId="int-discovery" icon={MapPin} title="int.discovery" desc="int.discoveryDesc" enabled extra={t("int.driver", { driver: stats.integrations.discoveryDriver })} />
          <StatusCard testId="int-places" icon={Layers} title="int.places" desc="int.placesDesc" enabled={stats.integrations.placesConfigured} />
          <StatusCard
            testId="int-llm" icon={Sparkles} title="int.llm" desc="int.llmDesc" enabled={stats.integrations.llmConfigured}
            extra={stats.integrations.llmConfigured ? t("int.llmUsage", { used: stats.llm.draftsToday, limit: stats.llm.dailyLimit }) : undefined}
          />
          <StatusCard testId="int-smtp" icon={Mail} title="int.smtp" desc="int.smtpDesc" enabled={stats.integrations.smtpVerify} />
          <StatusCard testId="int-pinterest" icon={ImageIcon} title="int.pinterest" desc="int.pinterestDesc" enabled={stats.integrations.pinterestConfigured} />
          <StatusCard testId="int-webhook" icon={Webhook} title="int.webhook" desc="int.webhookDesc" enabled={stats.integrations.webhook} />
          <motion.div variants={item} className="sm:col-span-2">
            <Card data-testid="int-queues">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("int.queues")}</CardTitle>
                <CardDescription className="text-xs">{t("int.queuesDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {(["pipeline", "scraper"] as const).map((q) => (
                  <p key={q}>{t("int.queueLine", { name: q, waiting: stats.queues[q].waiting ?? 0, active: stats.queues[q].active ?? 0, failed: stats.queues[q].failed ?? 0 })}</p>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}

      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center gap-4 py-4 flex-wrap">
          <div className="p-2 bg-gradient-brand rounded-lg flex-shrink-0 shadow-glow"><Zap className="w-5 h-5 text-white" /></div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{t("int.restApi")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t("int.restApiDesc")}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="outline" asChild>
              <a href={`${apiRoot}/api/docs`} target="_blank" rel="noreferrer">{t("int.swagger")}</a>
            </Button>
            <Button size="sm" asChild variant="gradient"><Link href="/settings">{t("int.apiKeys")}</Link></Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pt-2">{t("int.neverSends")}</p>
    </div>
  );
}
