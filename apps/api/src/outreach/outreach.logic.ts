// Pure drafting logic: context building, prompt rendering, validation, deterministic templates, links.
// NOTHING here sends a message. Every output is a draft (status: "draft").
import * as fs from "fs";
import * as path from "path";

export type Channel = "whatsapp" | "email";
export type Lang = "pt-BR" | "en";

export interface DraftContext {
  businessName: string;
  niche: string;
  city: string;
  fact: string;
  siteSituation: string;
  service: string;
  priceAnchor: string;
  deadline: string;
  sellerName: string;
}

export interface LeadFacts {
  name: string;
  rating: number | null;
  reviewCount: number | null;
  siteStatus: string;
  siteEvidence?: { url?: string | null; reason?: string } | null;
}

export interface Offer {
  niche: string;
  city: string;
  service?: string;
  priceAnchor?: string;
  deadline?: string;
  sellerName?: string;
}

export interface Draft {
  channel: Channel;
  lang: Lang;
  text: string;
  subject?: string;
  status: "draft";
  generatedAt: string;
  promptVersion: number;
  generator: "llm" | "template";
}

const hostOf = (u?: string | null): string => {
  try {
    return u ? new URL(u).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
};

export function siteSituation(f: LeadFacts, lang: Lang): string {
  const pt = lang === "pt-BR";
  const host = hostOf(f.siteEvidence?.url);
  switch (f.siteStatus) {
    case "NONE": return pt ? "o perfil de vocês no Google não tem um site" : "your Google profile does not list a website";
    case "SOCIAL_ONLY": return pt ? `o link do perfil de vocês leva só para ${host || "uma rede social"}, sem site próprio` : `your profile link only goes to ${host || "a social network"}, with no website of your own`;
    case "FREE_BUILDER": return pt ? `o site de vocês está num endereço gratuito (${host})` : `your site lives on a free address (${host})`;
    case "DEAD": return pt ? `o site cadastrado no Google${host ? ` (${host})` : ""} não está abrindo` : `the website listed on Google${host ? ` (${host})` : ""} is not loading`;
    default: return pt ? "não consegui confirmar se vocês têm um site" : "I could not confirm whether you have a website";
  }
}

/** Picks ONE verifiable fact about the lead (rating/reviews first, else the site situation). */
export function pickFact(f: LeadFacts, lang: Lang): string {
  const pt = lang === "pt-BR";
  if (f.rating != null && f.rating >= 4 && (f.reviewCount ?? 0) >= 10) {
    const r = pt ? String(f.rating).replace(".", ",") : String(f.rating);
    return pt ? `nota ${r} no Google com ${f.reviewCount} avaliações` : `${r} stars on Google with ${f.reviewCount} reviews`;
  }
  if ((f.reviewCount ?? 0) >= 10) return pt ? `${f.reviewCount} avaliações no Google` : `${f.reviewCount} reviews on Google`;
  return siteSituation(f, lang);
}

export function buildContext(f: LeadFacts, o: Offer, lang: Lang): DraftContext {
  return {
    businessName: f.name,
    niche: o.niche,
    city: o.city,
    fact: pickFact(f, lang),
    siteSituation: siteSituation(f, lang),
    service: o.service || (lang === "pt-BR" ? "criação de site profissional" : "professional website design"),
    priceAnchor: o.priceAnchor || "",
    deadline: o.deadline || "",
    sellerName: o.sellerName || "",
  };
}

export const PROMPT_DIR = path.join(__dirname, "prompts");

export interface PromptTemplate {
  version: number;
  system: string;
  user: string;
}

export function loadPrompt(channel: Channel, lang: Lang, dir = PROMPT_DIR): PromptTemplate {
  const raw = fs.readFileSync(path.join(dir, `${channel}.${lang}.md`), "utf8");
  const version = Number(raw.match(/<!--\s*version:\s*(\d+)\s*-->/)?.[1] ?? 1);
  const sys = raw.split(/^## SYSTEM\s*$/m)[1]?.split(/^## USER\s*$/m)[0]?.trim() ?? "";
  const user = raw.split(/^## USER\s*$/m)[1]?.trim() ?? "";
  if (!sys || !user) throw new Error(`Malformed prompt file for ${channel}.${lang}`);
  return { version, system: sys, user };
}

export function render(template: string, ctx: DraftContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => (ctx as unknown as Record<string, string>)[k] || "(n/d)");
}

const FORBIDDEN = [/garantid[oa]/i, /100\s?%/, /guarantee[d]?/i, /milagre/i, /miracle/i, /resultado[s]? garantido/i, /últim[ao]s? vaga/i, /only today|só hoje|somente hoje/i];

export interface Validation {
  ok: boolean;
  problems: string[];
}

export function validateDraft(channel: Channel, text: string, ctx: DraftContext, subject?: string): Validation {
  const problems: string[] = [];
  const max = channel === "whatsapp" ? 500 : 900;
  if (!text.trim()) problems.push("empty");
  if (text.length > max) problems.push(`too long (${text.length}>${max})`);
  if (FORBIDDEN.some((re) => re.test(text) || (subject ? re.test(subject) : false))) problems.push("forbidden promise/pressure wording");
  if (!text.trim().split("\n").filter(Boolean).slice(-3).join(" ").includes("?")) problems.push("does not end with a question");
  const hasFact = ctx.fact && text.toLowerCase().includes(ctx.fact.split(" ").slice(0, 2).join(" ").toLowerCase());
  const mentionsName = text.toLowerCase().includes(ctx.businessName.toLowerCase().split(" ")[0]);
  if (!hasFact && !mentionsName) problems.push("cites no real fact about the business");
  if (channel === "email" && (!subject || subject.length > 70)) problems.push("missing or long subject");
  if ((text.match(/\p{Extended_Pictographic}/gu) ?? []).length > 1 && channel === "whatsapp") problems.push("too many emojis");
  return { ok: problems.length === 0, problems };
}

/** Deterministic, factual fallback used when no LLM is configured or its output fails validation. */
export function templateDraft(channel: Channel, lang: Lang, ctx: DraftContext): { text: string; subject?: string } {
  const pt = lang === "pt-BR";
  const service = ctx.service.charAt(0).toLowerCase() + ctx.service.slice(1);
  const sign = ctx.sellerName ? (pt ? `\n${ctx.sellerName}` : `\n${ctx.sellerName}`) : "";
  const offer = ctx.priceAnchor || ctx.deadline
    ? pt
      ? ` Faço isso ${[ctx.priceAnchor, ctx.deadline && `em ${ctx.deadline}`].filter(Boolean).join(", ")}.`
      : ` I do this ${[ctx.priceAnchor, ctx.deadline && `in ${ctx.deadline}`].filter(Boolean).join(", ")}.`
    : "";
  if (channel === "whatsapp") {
    const text = pt
      ? `Olá! Vi a ${ctx.businessName} (${ctx.fact}) e notei que ${ctx.siteSituation}. Eu trabalho com ${service} para ${ctx.niche} em ${ctx.city}.${offer} Faz sentido eu te mostrar como ficaria o site da ${ctx.businessName}?${sign}`
      : `Hi! I found ${ctx.businessName} (${ctx.fact}) and noticed that ${ctx.siteSituation}. I do ${service} for ${ctx.niche} businesses in ${ctx.city}.${offer} Would it make sense to show you what a site for ${ctx.businessName} could look like?${sign}`;
    return { text };
  }
  return pt
    ? {
        subject: `Site para a ${ctx.businessName}`.slice(0, 60),
        text: `Olá,\n\nVi a ${ctx.businessName} (${ctx.fact}) e notei que ${ctx.siteSituation}. Eu trabalho com ${service} para ${ctx.niche} em ${ctx.city}.${offer}\n\nPosso te enviar um exemplo de como ficaria o site da ${ctx.businessName}?${sign ? `\n\nAbraço,${sign}` : ""}`,
      }
    : {
        subject: `A website for ${ctx.businessName}`.slice(0, 60),
        text: `Hello,\n\nI found ${ctx.businessName} (${ctx.fact}) and noticed that ${ctx.siteSituation}. I do ${service} for ${ctx.niche} businesses in ${ctx.city}.${offer}\n\nCan I send you an example of what a site for ${ctx.businessName} could look like?${sign ? `\n\nBest,${sign}` : ""}`,
      };
}

export function waLink(e164: string | null | undefined, text: string): string | null {
  const digits = (e164 ?? "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function mailtoLink(email: string | null | undefined, subject: string, body: string): string | null {
  return email ? `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : null;
}
