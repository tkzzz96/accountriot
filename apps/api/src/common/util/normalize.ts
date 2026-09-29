/** Normalize a phone to E.164-ish digits with "+" prefix. Returns null if not plausible. */
export function normalizePhone(raw: string | null | undefined, defaultCountryCode = "55"): string | null {
  if (!raw) return null;
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (!hasPlus) {
    if (digits.startsWith("00")) digits = digits.slice(2);
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

const CALLING_CODES: Record<string, string> = {
  brazil: "55", brasil: "55", br: "55",
  portugal: "351", pt: "351",
  "united states": "1", usa: "1", us: "1", eua: "1", "estados unidos": "1",
  canada: "1", ca: "1",
  "united kingdom": "44", uk: "44", gb: "44",
  argentina: "54", chile: "56", colombia: "57", mexico: "52", méxico: "52",
  spain: "34", espanha: "34", españa: "34", es: "34",
  germany: "49", alemanha: "49", france: "33", frança: "33", italy: "39", itália: "39",
  australia: "61", indonesia: "62",
};

export function countryCallingCode(country: string | null | undefined): string {
  return CALLING_CODES[(country ?? "").trim().toLowerCase()] ?? "55";
}
