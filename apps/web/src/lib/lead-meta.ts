import type { MessageKey } from "@/locales/pt-BR";

export type BadgeTone = "success" | "warning" | "info" | "secondary" | "destructive";

export const SITE_STATUSES = ["NONE", "SOCIAL_ONLY", "FREE_BUILDER", "DEAD", "HAS_SITE", "UNKNOWN"] as const;
export const SITE_META: Record<string, { key: MessageKey; tone: BadgeTone }> = {
  NONE: { key: "site.NONE", tone: "success" },
  SOCIAL_ONLY: { key: "site.SOCIAL_ONLY", tone: "success" },
  FREE_BUILDER: { key: "site.FREE_BUILDER", tone: "warning" },
  DEAD: { key: "site.DEAD", tone: "warning" },
  HAS_SITE: { key: "site.HAS_SITE", tone: "info" },
  UNKNOWN: { key: "site.UNKNOWN", tone: "secondary" },
};

export const STAGE_KEY: Record<string, MessageKey> = {
  DISCOVERED: "stage.DISCOVERED", CLASSIFIED: "stage.CLASSIFIED", ENRICHED: "stage.ENRICHED", SCORED: "stage.SCORED",
  DRAFTED: "stage.DRAFTED", READY: "stage.READY", FAILED: "stage.FAILED",
};

export const CRM_STATUSES = ["new", "contacted", "replied", "meeting", "proposal", "won", "lost"] as const;
export type CrmStatus = (typeof CRM_STATUSES)[number];
export const CRM_META: Record<CrmStatus, { key: MessageKey; tone: BadgeTone }> = {
  new: { key: "crm.new", tone: "secondary" },
  contacted: { key: "crm.contacted", tone: "info" },
  replied: { key: "crm.replied", tone: "info" },
  meeting: { key: "crm.meeting", tone: "warning" },
  proposal: { key: "crm.proposal", tone: "warning" },
  won: { key: "crm.won", tone: "success" },
  lost: { key: "crm.lost", tone: "destructive" },
};

export const PRIORITY_META: Record<string, { key: MessageKey; tone: BadgeTone }> = {
  HIGH: { key: "prio.HIGH", tone: "success" },
  MEDIUM: { key: "prio.MEDIUM", tone: "warning" },
  LOW: { key: "prio.LOW", tone: "secondary" },
};

/** Evidence codes produced by the site classifier => translation keys. Unknown codes fall back to the classifier's own reason. */
export const EVIDENCE_KEY: Record<string, MessageKey> = {
  NO_WEBSITE: "ev.NO_WEBSITE", SOCIAL_PROFILE: "ev.SOCIAL_PROFILE", FREE_BUILDER: "ev.FREE_BUILDER", UNPARSEABLE_URL: "ev.UNPARSEABLE_URL",
  DNS_FAILURE: "ev.DNS_FAILURE", NO_RESPONSE: "ev.NO_RESPONSE", PARKED_DOMAIN: "ev.PARKED_DOMAIN", HTTP_OK: "ev.HTTP_OK",
  BOT_BLOCKED: "ev.BOT_BLOCKED", HTTP_ERROR: "ev.HTTP_ERROR", HTTP_AMBIGUOUS: "ev.HTTP_AMBIGUOUS", REDIRECT_SOCIAL: "ev.REDIRECT_SOCIAL",
  REDIRECT_FREE_BUILDER: "ev.REDIRECT_FREE_BUILDER", OFFLINE: "ev.OFFLINE", NON_PUBLIC_ADDRESS: "ev.NON_PUBLIC_ADDRESS",
};

/** Budget labels are produced by the API in Portuguese; map them so the English UI can show them too. */
export const BUDGET_LABEL_KEY: Record<string, MessageKey> = {
  provável: "budget.likely", incerto: "budget.uncertain", improvável: "budget.unlikely",
};
export const BUDGET_DISCLAIMER = "Estimativa baseada em sinais públicos; a capacidade real de pagar não é conhecida.";
