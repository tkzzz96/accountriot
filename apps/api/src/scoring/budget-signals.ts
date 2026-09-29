// Budget capacity is NOT public data. This produces an explainable *estimate* (0-100) from proxies,
// always presented as "provável / incerto / improvável", never as a fact.
export interface BudgetInput {
  priceRange: string | null; // "$", "$$", "$$$" or Places priceLevel enum
  reviewCount: number | null;
  rating: number | null;
  photoCount: number | null;
  claimed: boolean | null;
  hasSocial: boolean;
  sizeHint?: string | null; // campaign hint: micro | small | medium
  budgetUsd?: number | null; // target ticket
}

export interface BudgetSignal {
  signal: string;
  points: number;
  detail: string;
}

export interface BudgetResult {
  budgetScore: number;
  label: "provável" | "incerto" | "improvável";
  disclaimer: string;
  signals: BudgetSignal[];
}

function priceTier(p: string | null): number {
  if (!p) return 0;
  const dollars = (p.match(/\$/g) ?? []).length;
  if (dollars) return dollars;
  const map: Record<string, number> = {
    PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return map[p] ?? 0;
}

export function budgetSignals(i: BudgetInput): BudgetResult {
  const signals: BudgetSignal[] = [];
  const add = (signal: string, points: number, detail: string) => signals.push({ signal, points: Math.round(points), detail });

  const tier = priceTier(i.priceRange);
  add("priceRange", tier ? Math.min(tier, 4) * 6 : 0, tier ? `faixa de preço ${i.priceRange}` : "faixa de preço não informada");

  const rev = i.reviewCount ?? 0;
  add("reviewVolume", Math.min(30, Math.log10(1 + rev) * 12), `${rev} avaliações (proxy de fluxo de clientes)`);

  const r = i.rating ?? 0;
  add("rating", r >= 4.5 ? 12 : r >= 4 ? 8 : r >= 3.5 ? 3 : 0, r ? `nota ${r}★` : "sem nota");

  const ph = i.photoCount ?? 0;
  add("photos", Math.min(10, ph), ph ? `${ph} fotos (investe em imagem)` : "sem fotos");

  add("claimedProfile", i.claimed ? 8 : 0, i.claimed ? "perfil reivindicado (gestão ativa)" : "perfil não reivindicado/desconhecido");
  add("socialPresence", i.hasSocial ? 8 : 0, i.hasSocial ? "presença em redes sociais" : "sem redes sociais detectadas");

  const size = i.sizeHint === "medium" ? 12 : i.sizeHint === "small" ? 6 : 0;
  add("sizeHint", size, `porte informado na campanha: ${i.sizeHint ?? "n/d"}`);

  const raw = signals.reduce((s, x) => s + x.points, 0);
  // A higher target ticket demands more evidence: shift the score down for expensive offers.
  const ticketPenalty = i.budgetUsd && i.budgetUsd > 1500 ? 10 : 0;
  const budgetScore = Math.max(0, Math.min(100, raw - ticketPenalty));
  const label = budgetScore >= 60 ? "provável" : budgetScore >= 35 ? "incerto" : "improvável";
  return {
    budgetScore,
    label,
    disclaimer: "Estimativa baseada em sinais públicos; a capacidade real de pagar não é conhecida.",
    signals,
  };
}
