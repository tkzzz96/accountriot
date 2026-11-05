import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return n.toString();
}

/** Current UI locale as set by the I18nProvider on <html lang>. */
export function currentLocale(): string {
  return typeof document !== "undefined" && document.documentElement.lang ? document.documentElement.lang : "pt-BR";
}

export function formatDate(date: string | Date, locale: string = currentLocale()): string {
  return new Date(date).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
