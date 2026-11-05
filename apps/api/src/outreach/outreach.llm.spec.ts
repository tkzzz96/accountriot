import { describe, expect, it, vi } from "vitest";
import { ConfigService } from "@nestjs/config";
import { LlmClient, OutreachService } from "./outreach.service";

const facts = { name: "Padaria Sol", rating: 4.6, reviewCount: 120, siteStatus: "NONE", siteEvidence: { reason: "no url" } };
const offer = { niche: "padaria", city: "Santos", service: "site institucional", priceAnchor: "US$500", deadline: "7 dias", sellerName: "Ryan" };
const cfg = (env: Record<string, string> = {}) => ({ get: (k: string) => env[k] }) as unknown as ConfigService;

describe("OutreachService (LLM injection)", () => {
  it("falls back to the template when no key is available", async () => {
    const d = await new OutreachService(cfg()).draft(facts, offer, "whatsapp", "pt-BR");
    expect(d.generator).toBe("template");
    expect(d.status).toBe("draft");
  });

  it("uses the injected client, with max_tokens 500, and still validates the output", async () => {
    const complete = vi.fn(async () => "Oi, vi a Padaria Sol em Santos e notei que ainda não há um site. Posso te mostrar 3 exemplos?");
    const client: LlmClient = { complete };
    const d = await new OutreachService(cfg(), client).draft(facts, offer, "whatsapp", "pt-BR");
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0][0]).toMatchObject({ maxTokens: 500, json: false });
    expect(["llm", "template"]).toContain(d.generator);
    expect(d.status).toBe("draft");
  });

  it("allowLlm=false never calls the client (daily cap)", async () => {
    const complete = vi.fn(async () => "x");
    const d = await new OutreachService(cfg(), { complete }).draft(facts, offer, "whatsapp", "pt-BR", { allowLlm: false });
    expect(complete).not.toHaveBeenCalled();
    expect(d.generator).toBe("template");
  });

  it("recovers from client errors and bad JSON with the template", async () => {
    const boom = new OutreachService(cfg(), { complete: async () => { throw new Error("429"); } });
    expect((await boom.draft(facts, offer, "whatsapp", "pt-BR")).generator).toBe("template");
    const badJson = new OutreachService(cfg(), { complete: async () => "not json" });
    expect((await badJson.draft(facts, offer, "email", "pt-BR")).generator).toBe("template");
  });

  it("hasLlm reflects key availability and the cap", () => {
    expect(new OutreachService(cfg()).hasLlm()).toBe(false);
    expect(new OutreachService(cfg()).hasLlm({ llm: { apiKey: "sk-x" } })).toBe(true);
    expect(new OutreachService(cfg({ OPENAI_API_KEY: "sk-env" })).hasLlm()).toBe(true);
    expect(new OutreachService(cfg({ OPENAI_API_KEY: "sk-env" })).hasLlm({ allowLlm: false })).toBe(false);
  });
});
