/** Normalize a phone to E.164-ish digits with "+" prefix. Returns null if not plausible. */
/** `defaultCountryCode` "" means "unknown country": only numbers that already carry a country code are accepted. */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "55"): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus) {
    if (digits.startsWith("00")) digits = digits.slice(2);
    else if (!defaultCountryCode) return null;
    else if (digits.startsWith("0")) digits = defaultCountryCode + digits.replace(/^0+/, "");
    else if (digits.length <= 11) digits = defaultCountryCode + digits;
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

const stripAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

export function normalizeText(s: string | null | undefined): string {
  return stripAccents((s ?? "").toLowerCase()).replace(/[^a-z0-9]+/g, " ").trim();
}

/** Stable dedupe key: phone when present, else normalized name|address. */
export function buildDedupeKey(input: { name: string; address?: string | null; phone?: string | null }, defaultCountryCode = "55"): string {
  const phone = normalizePhone(input.phone, defaultCountryCode);
  if (phone) return `tel:${phone}`;
  return `na:${normalizeText(input.name)}|${normalizeText(input.address)}`;
}

// Keys are lowercase, accent-free names in pt-BR / en / es (lookup normalizes the input the same way).
const CALLING_CODES: Record<string, string> = {
  brazil: "55", brasil: "55", br: "55",
  portugal: "351", pt: "351",
  "united states": "1", usa: "1", us: "1", eua: "1", "estados unidos": "1", "estados unidos da america": "1", canada: "1", ca: "1",
  "dominican republic": "1", "republica dominicana": "1",
  "united kingdom": "44", uk: "44", gb: "44", "reino unido": "44", inglaterra: "44", england: "44", escocia: "44", scotland: "44",
  argentina: "54", chile: "56", colombia: "57", mexico: "52", peru: "51", ecuador: "593", equador: "593", venezuela: "58",
  bolivia: "591", uruguay: "598", uruguai: "598", paraguay: "595", paraguai: "595", "costa rica": "506", panama: "507",
  spain: "34", espanha: "34", espana: "34", es: "34", germany: "49", alemanha: "49", france: "33", franca: "33",
  italy: "39", italia: "39", netherlands: "31", holanda: "31", "paises baixos": "31", belgium: "32", belgica: "32",
  switzerland: "41", suica: "41", austria: "43", ireland: "353", irlanda: "353", sweden: "46", suecia: "46", norway: "47",
  noruega: "47", denmark: "45", dinamarca: "45", poland: "48", polonia: "48", greece: "30", grecia: "30", turkey: "90", turquia: "90",
  russia: "7", ukraine: "380", ucrania: "380", hungary: "36", hungria: "36", romania: "40", romenia: "40",
  "czech republic": "420", "republica tcheca": "420",
  australia: "61", "new zealand": "64", "nova zelandia": "64", japan: "81", japao: "81", china: "86", india: "91",
  "south korea": "82", "coreia do sul": "82", indonesia: "62", israel: "972", egypt: "20", egito: "20", morocco: "212", marrocos: "212",
  nigeria: "234", kenya: "254", quenia: "254", "south africa": "27", "africa do sul": "27",
  angola: "244", mozambique: "258", mocambique: "258", "cabo verde": "238", "united arab emirates": "971", uae: "971",
  "emirados arabes unidos": "971",
};
const NORMALIZED_CODES: Record<string, string> = Object.fromEntries(Object.entries(CALLING_CODES).map(([k, v]) => [normalizeText(k), v]));

export function countryCallingCode(country: string | null | undefined): string {
  return NORMALIZED_CODES[normalizeText(country)] ?? ""; // accent/case-insensitive; unknown: never guess a country
}
