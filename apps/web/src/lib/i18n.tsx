"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ptBR, type MessageKey } from "@/locales/pt-BR";
import { en } from "@/locales/en";

export type Locale = "pt-BR" | "en";
export const LOCALES: Locale[] = ["pt-BR", "en"];
const STORAGE_KEY = "prospector_lang";
const catalogs: Record<Locale, Record<MessageKey, string>> = { "pt-BR": ptBR, en };

export type Vars = Record<string, string | number>;

/** Pure translation: unknown keys fall back to pt-BR, then to the key itself; `{name}` placeholders are interpolated. */
export function translate(locale: Locale, key: MessageKey, vars?: Vars): string {
  const raw = catalogs[locale][key] ?? ptBR[key] ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
}

interface I18nValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: MessageKey, vars?: Vars) => string;
}
const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "pt-BR" || stored === "en") return stored;
  } catch {
    // storage blocked (private mode): fall through to the default
  }
  return "pt-BR";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start with the default so server and first client render match; the stored choice is applied right after mount.
  const [locale, setLocaleState] = useState<Locale>("pt-BR");
  useEffect(() => {
    setLocaleState(initialLocale());
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === "en" ? "en" : "pt-BR";
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      // not persisted; still applies for this visit
    }
  }, []);
  const t = useCallback((key: MessageKey, vars?: Vars) => translate(locale, key, vars), [locale]);
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
