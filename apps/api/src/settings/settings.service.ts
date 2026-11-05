import { randomBytes, createHash } from "crypto";
import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { encryptSecret, decryptSecret } from "./encryption.util";

const DEFAULT_WORKSPACE_ID = "default-workspace";
const SECRET_CONFIG_KEYS = ["apiKey"];
const MASK = "••••";

export const isMasked = (v: string | undefined): boolean => typeof v === "string" && v.startsWith(MASK);
export function maskSecrets(config: Record<string, string>): Record<string, string> {
  const out = { ...config };
  for (const k of SECRET_CONFIG_KEYS) if (out[k]) out[k] = `${MASK}${out[k].slice(-4)}`;
  return out;
}

@Injectable()
export class SettingsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.config.get<string>("ENCRYPTION_KEY")!;
  }

  private decryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = decryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  private encryptConfig(config: Record<string, string>): Record<string, string> {
    const result = { ...config };
    for (const key of SECRET_CONFIG_KEYS) {
      if (result[key]) result[key] = encryptSecret(result[key], this.encryptionKey);
    }
    return result;
  }

  /** Integrations for the UI: secrets are masked ("••••abcd"), never sent back in clear text. */
  async getIntegrations(workspaceId = DEFAULT_WORKSPACE_ID) {
    const integrations = await this.prisma.integration.findMany({ where: { workspaceId } });
    return integrations.map((integration) => ({
      ...integration,
      config: maskSecrets(this.decryptConfig(integration.config as Record<string, string>)),
    }));
  }

  /** The workspace's own LLM settings (clear text, server-side use only), or null when none are saved/enabled. */
  async getLlmConfig(workspaceId: string): Promise<{ apiKey: string; model?: string; baseURL?: string } | null> {
    const row = await this.prisma.integration.findFirst({ where: { workspaceId, type: "openai", enabled: true } });
    if (!row) return null;
    const c = this.decryptConfig(row.config as Record<string, string>);
    return c.apiKey ? { apiKey: c.apiKey, model: c.model || undefined, baseURL: c.baseURL || undefined } : null;
  }

  async upsertIntegration(
    type: string,
    name: string,
    config: Record<string, string>,
    workspaceId = DEFAULT_WORKSPACE_ID,
  ) {
    const existing = await this.prisma.integration.findFirst({ where: { workspaceId, type } });
    // The UI shows masked secrets: a masked value coming back means "keep the stored one".
    const incoming = { ...config };
    if (existing) {
      const stored = this.decryptConfig(existing.config as Record<string, string>);
      for (const k of SECRET_CONFIG_KEYS) if (isMasked(incoming[k])) incoming[k] = stored[k] ?? "";
    }
    const encryptedConfig = this.encryptConfig(incoming);
    if (existing) {
      return this.prisma.integration.update({
        where: { id: existing.id },
        data: { config: encryptedConfig, enabled: true },
      });
    }
    return this.prisma.integration.create({ data: { type, name, config: encryptedConfig, workspaceId } });
  }

  async listApiKeys(workspaceId = DEFAULT_WORKSPACE_ID) {
    return this.prisma.apiKey.findMany({
      where: { workspaceId },
      select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    });
  }

  async createApiKey(name: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const plaintext = `px_${randomBytes(32).toString("base64url")}`;
    const keyHash = createHash("sha256").update(plaintext).digest("hex");
    const keyPrefix = plaintext.slice(0, 10); // "px_" + first 7 chars

    await this.prisma.apiKey.create({
      data: { name, keyHash, keyPrefix, workspaceId },
    });

    // Return the plaintext key exactly once — it is never stored and cannot be recovered
    return { name, keyPrefix, key: plaintext, note: "Store this key securely — it will not be shown again." };
  }

  async deleteApiKey(id: string, workspaceId = DEFAULT_WORKSPACE_ID) {
    const key = await this.prisma.apiKey.findFirst({ where: { id, workspaceId } });
    if (!key) throw new NotFoundException("API key not found");
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
