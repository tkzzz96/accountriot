import type { OpsStats } from "@/hooks/use-ops";
import type { MessageKey } from "@/locales/pt-BR";

export interface Notice {
  id: string;
  title: MessageKey;
  hint: MessageKey;
  n?: number;
  href: string;
}

/** Turns real pipeline numbers into actionable notices. Nothing is fabricated: no data => no notices. */
export function buildNotices(s: OpsStats | null): Notice[] {
  if (!s) return [];
  const out: Notice[] = [];
  const failed = s.leadsByStage.FAILED ?? 0;
  if (failed > 0) out.push({ id: "failed", title: "header.notifFailed", hint: "header.notifFailedHint", n: failed, href: "/leads?stage=FAILED" });
  const running = s.campaignsByStatus.running ?? 0;
  if (running > 0) out.push({ id: "running", title: "header.notifRunning", hint: "header.notifRunningHint", n: running, href: "/campaigns" });
  const qFailed = (s.queues.pipeline.failed ?? 0) + (s.queues.scraper.failed ?? 0);
  if (qFailed > 0) out.push({ id: "queue", title: "header.notifQueue", hint: "header.notifQueueHint", n: qFailed, href: "/integrations" });
  const unknown = s.leadsBySiteStatus.UNKNOWN ?? 0;
  if (unknown > 0) out.push({ id: "review", title: "header.notifReview", hint: "header.notifReviewHint", n: unknown, href: "/leads?siteStatus=UNKNOWN" });
  if (s.llm.dailyLimit > 0 && s.llm.draftsToday >= s.llm.dailyLimit) out.push({ id: "llm", title: "header.notifLlm", hint: "header.notifLlmHint", href: "/integrations" });
  return out;
}
