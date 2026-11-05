"use client";

import { useI18n } from "@/lib/i18n";
import type { MessageKey } from "@/locales/pt-BR";

export function PageHeader({ title, subtitle, children }: { title: MessageKey; subtitle?: MessageKey; children?: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t(title)}</h1>
        {subtitle && <p className="text-muted-foreground">{t(subtitle)}</p>}
      </div>
      {children}
    </div>
  );
}
