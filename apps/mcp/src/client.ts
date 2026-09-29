// Thin REST client for the Prospector API. Logs in with PROSPECTOR_EMAIL / PROSPECTOR_PASSWORD.
export interface ClientConfig {
  baseUrl: string;
  email: string;
  password: string;
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): ClientConfig {
  const email = env.PROSPECTOR_EMAIL;
  const password = env.PROSPECTOR_PASSWORD;
  if (!email || !password) throw new Error("Set PROSPECTOR_EMAIL and PROSPECTOR_PASSWORD (and optionally PROSPECTOR_API_URL)");
  return { baseUrl: (env.PROSPECTOR_API_URL ?? "http://localhost:3001/api").replace(/\/$/, ""), email, password };
}

export class ProspectorClient {
  private token: string | null = null;
  constructor(private cfg: ClientConfig, private fetchImpl: typeof fetch = fetch) {}

  private async login(): Promise<string> {
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
    this.token ??= await this.login();
    const res = await this.fetchImpl(`${this.cfg.baseUrl}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401 && retry) {
      this.token = null;
      return this.request<T>(method, path, body, false);
    }
    if (!res.ok) throw new Error(`${method} ${path} failed: HTTP ${res.status} ${await res.text()}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  }
}
