import { DEFAULT_PRESET, PRESETS, SITE_GAP_FACTOR, ScoreWeights, TIER_THRESHOLDS } from "./weights";
import { normalizeText } from "../common/util/normalize";

export interface ScoreInput {
  siteStatus: string;
  hasWhatsapp: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
  rating: number | null;
  reviewCount: number | null;
  claimed: boolean | null;
  hasSocial: boolean;
  category: string | null;
  name: string;
  niche: string;
}

export interface ScoreFactor {
  key: keyof ScoreWeights;
  label: string;
  points: number;
  max: number;
  reason: string;
}

export interface ScoreResult {
  score: number;
  tier: "HOT" | "WARM" | "COLD";
  /** Stored in Lead.priority for the existing UI (HOT=HIGH, WARM=MEDIUM, COLD=LOW). */
  priority: "HIGH" | "MEDIUM" | "LOW";
  preset: string;
  breakdown: ScoreFactor[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Bayesian-smoothed rating: pulls low-volume ratings toward 4.0 so 5★/1 review can't dominate. */
export function smoothedRating(rating: number, reviews: number): number {
  const PRIOR_MEAN = 4.0;
  const PRIOR_WEIGHT = 20;
  return (PRIOR_WEIGHT * PRIOR_MEAN + reviews * rating) / (PRIOR_WEIGHT + reviews);
}

export function categoryMatches(niche: string, category: string | null, name: string): boolean {
  const tokens = normalizeText(niche).split(" ").filter((t) => t.length > 2);
  if (tokens.length === 0) return false;
  const hay = normalizeText(`${category ?? ""} ${name}`);
  return tokens.some((t) => hay.includes(t.replace(/s$/, "")));
}

export function scoreLead(input: ScoreInput, preset = DEFAULT_PRESET, overrides?: Partial<ScoreWeights>): ScoreResult {
  const w: ScoreWeights = { ...(PRESETS[preset] ?? PRESETS[DEFAULT_PRESET]), ...(overrides ?? {}) };
  const f: ScoreFactor[] = [];
  const add = (key: keyof ScoreWeights, label: string, share: number, reason: string) =>
    f.push({ key, label, points: round1(w[key] * Math.min(1, Math.max(0, share))), max: w[key], reason });

  const gap = SITE_GAP_FACTOR[input.siteStatus] ?? 0;
  add("siteGap", "Sem presença web própria", gap, `siteStatus=${input.siteStatus}`);

  const contactShare = input.hasWhatsapp ? 1 : input.hasPhone ? 0.6 : input.hasEmail ? 0.4 : 0;
  add(
    "contactability",
    "Contato disponível",
    contactShare + (input.hasEmail && (input.hasWhatsapp || input.hasPhone) ? 0 : 0),
    input.hasWhatsapp ? "WhatsApp identificado" : input.hasPhone ? "Somente telefone" : input.hasEmail ? "Somente e-mail" : "Nenhum contato",
  );

  if (input.rating != null && input.rating > 0) {
    const r = smoothedRating(input.rating, input.reviewCount ?? 0);
    add("rating", "Nota no Google", (r - 3.5) / 1.3, `nota ${input.rating}★ (suavizada ${round1(r)})`);
  } else add("rating", "Nota no Google", 0, "sem nota");

  const rev = input.reviewCount ?? 0;
  add("reviews", "Volume de avaliações", Math.log10(1 + rev) / Math.log10(1 + 300), `${rev} avaliações`);

  add(
    "unclaimedProfile",
    "Perfil do Google não reivindicado",
    input.claimed === false ? 1 : 0,
    input.claimed === false ? "perfil sem dono verificado" : input.claimed === true ? "perfil reivindicado" : "informação indisponível",
  );
  add("socialPresence", "Presença social ativa", input.hasSocial ? 1 : 0, input.hasSocial ? "perfil social encontrado" : "nenhum perfil social encontrado");
  const cm = categoryMatches(input.niche, input.category, input.name);
  add("categoryMatch", "Categoria bate com o nicho", cm ? 1 : 0, cm ? "nicho aparece na categoria/nome" : "sem correspondência");

  const total = Math.min(100, Math.round(f.reduce((s, x) => s + x.points, 0)));
  const tier = total >= TIER_THRESHOLDS.hot ? "HOT" : total >= TIER_THRESHOLDS.warm ? "WARM" : "COLD";
  return { score: total, tier, priority: tier === "HOT" ? "HIGH" : tier === "WARM" ? "MEDIUM" : "LOW", preset, breakdown: f };
}
