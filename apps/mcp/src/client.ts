// Thin REST client for the Prospector API. Preferred auth: a workspace API key (PROSPECTOR_API_KEY, "px_…").
// Fallback: log in with PROSPECTOR_EMAIL / PROSPECTOR_PASSWORD.
export interface ClientConfig {
  baseUrl: string;
  /** Workspace API key. When set, no login happens and e-mail/password are not needed. */
  apiKey?: string;
  email?: string;
  password?: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ClientConfig {
  const baseUrl = (env.PROSPECTOR_API_URL ?? "http://localhost:3001/api").replace(/\/$/, "");
  const apiKey = env.PROSPECTOR_API_KEY?.trim();
  if (apiKey) {
    if (!apiKey.startsWith("px_")) throw new Error("PROSPECTOR_API_KEY must be a Prospector API key (starts with px_)");
    return { baseUrl, apiKey };
  }
  const email = env.PROSPECTOR_EMAIL;
  const password = env.PROSPECTOR_PASSWORD;
  if (!email || !password) {
    throw new Error("Set PROSPECTOR_API_KEY (preferred) or PROSPECTOR_EMAIL and PROSPECTOR_PASSWORD (and optionally PROSPECTOR_API_URL)");
  }
  return { baseUrl, email, password };
}

export class ProspectorClient {
  private token: string | null = null;
  constructor(private cfg: ClientConfig, private fetchImpl: typeof fetch = fetch) {}

  private async login(): Promise<string> {
    if (!this.cfg.email || !this.cfg.password) throw new Error("No credentials configured");
    const res = await this.fetchImpl(`${this.cfg.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: this.cfg.email, password: this.cfg.password }),
    });
    if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);
    const j = (await res.json()) as Record<string, string>;
    const t = j.accessToken ?? j.access_token ?? j.token;
    if (!t) throw new Error("Login response has no token");
    return t;
  }

  async request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
    const authorization = this.cfg.apiKey ? `ApiKey ${this.cfg.apiKey}` : `Bearer ${(this.token ??= await this.login())}`;
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method,
      headers: { authorization, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && retry && !this.cfg.apiKey) {
      this.token = null;
      return this.request<T>(method, path, body, false);
    }
    if (!res.ok) throw new Error(`${method} ${path} failed: HTTP ${res.status} ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
}
