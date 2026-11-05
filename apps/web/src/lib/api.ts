const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
const CSRF_COOKIE = "prospector_csrf";

/** Thrown for every non-2xx response and for network failures (`status` 0). */
export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

/** Reads a non-httpOnly cookie. The CSRF cookie is readable on purpose; the session cookie is httpOnly and never visible here. */
function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
}

/** Network failures ("Failed to fetch") get an actionable message instead of the browser's cryptic one. */
async function doFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { credentials: "include", ...init });
  } catch {
    throw new ApiError(
      `Não foi possível conectar à API (${API_URL}). Verifique se ela está rodando (pnpm app) e se o endereço do navegador é http://localhost:3000.`,
      0,
    );
  }
}

function csrfHeaders(method: string): Record<string, string> {
  if (["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase())) return {};
  const token = readCookie(CSRF_COOKIE);
  return token ? { "x-csrf-token": token } : {};
}

function goToLogin() {
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/register")) {
    window.location.href = "/login";
  }
}

async function errorFrom(res: Response): Promise<ApiError> {
  const body = await res.json().catch(() => ({}) as { message?: string | string[] });
  const msg = Array.isArray(body.message) ? body.message.join("; ") : body.message;
  return new ApiError(msg || `HTTP ${res.status}`, res.status);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method ?? "GET";
  const res = await doFetch(`${API_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...csrfHeaders(method), ...options.headers },
  });

  if (res.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
    goToLogin();
    throw new ApiError("Unauthorized", 401);
  }
  if (!res.ok) throw await errorFrom(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: "DELETE", body: body === undefined ? undefined : JSON.stringify(body) }),

  /** Fetch a file (session cookie travels automatically) and trigger a browser download. */
  async download(path: string, filename: string): Promise<void> {
    const res = await doFetch(`${API_URL}${path}`, {});
    if (res.status === 401) {
      goToLogin();
      return;
    }
    if (!res.ok) throw await errorFrom(res);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};
