"use client";

import { useI18n } from "@/lib/i18n";

export function AuthHeading({ kind }: { kind: "login" | "register" }) {
  const { t } = useI18n();
  return (
    <>
      <h1 className="text-2xl font-bold text-white">{kind === "login" ? t("auth.welcomeBack") : t("auth.createAccount")}</h1>
      <p className="text-slate-400 mt-1 text-sm">{kind === "login" ? t("auth.signInSubtitle") : t("auth.createSubtitle")}</p>
    </>
  );
}

export function AuthFooterLink() {
  const { t } = useI18n();
  return (
    <p className="text-center text-sm text-slate-500 mt-4">
      {t("auth.haveAccount")}{" "}
      <a href="/login" className="text-primary hover:text-primary/80 font-medium">{t("auth.signIn")}</a>
    </p>
  );
}
