import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import {
  Channel, Draft, DraftContext, Lang, LeadFacts, Offer,
  buildContext, loadPrompt, render, templateDraft, validateDraft,
} from "./outreach.logic";

/** Generates message DRAFTS only. There is intentionally no send capability anywhere in this module. */
@Injectable()
export class OutreachService {
  private readonly logger = new Logger(OutreachService.name);
  private openai: OpenAI | null = null;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("OPENAI_API_KEY");
    if (apiKey) {
      this.openai = new OpenAI({ apiKey, baseURL: this.config.get<string>("OPENAI_BASE_URL") || undefined });
    }
  }

  async draft(facts: LeadFacts, offer: Offer, channel: Channel, lang: Lang): Promise<Draft> {
    const ctx = buildContext(facts, offer, lang);
    const prompt = loadPrompt(channel, lang);
    const base = { channel, lang, status: "draft" as const, generatedAt: new Date().toISOString(), promptVersion: prompt.version };

    if (this.openai) {
      try {
        const out = await this.callLlm(prompt.system, render(prompt.user, ctx), channel);
        const v = validateDraft(channel, out.text, ctx, out.subject);
        if (v.ok) return { ...base, ...out, generator: "llm" };
        this.logger.warn(`LLM draft rejected (${v.problems.join(", ")}); using template`);
      } catch (err) {
        this.logger.warn(`LLM draft failed: ${err instanceof Error ? err.message : String(err)}; using template`);
      }
    }
    const t = templateDraft(channel, lang, ctx);
    return { ...base, ...t, generator: "template" };
  }

  private async callLlm(system: string, user: string, channel: Channel): Promise<{ text: string; subject?: string }> {
    const model = this.config.get<string>("OPENAI_MODEL") || "gpt-4o-mini";
    const res = await this.openai!.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      ...(channel === "email" ? { response_format: { type: "json_object" as const } } : {}),
    });
    const content = res.choices[0].message.content?.trim() ?? "";
    if (channel === "email") {
      const j = JSON.parse(content) as { subject?: string; body?: string };
      return { subject: j.subject, text: j.body ?? "" };
    }
    return { text: content };
  }
}

export type { DraftContext };
