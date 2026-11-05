import path from "path";
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/** Origin of the API (browser XHR/fetch target), so `connect-src` can allow exactly it. */
function apiOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api").origin;
  } catch {
    return "http://localhost:3001";
  }
}

/**
 * Content-Security-Policy. Next.js injects inline bootstrap scripts, so `script-src` needs 'unsafe-inline' (a nonce-based policy would
 * force every page to be dynamically rendered). Everything else is locked down: no plugins, no framing, no foreign form targets,
 * XHR only to this origin and the API. Images are allowed from any https origin because map tiles (OpenStreetMap) and the
 * reference thumbnails are third-party by design; they are never stored.
 */
function contentSecurityPolicy(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'", apiOrigin(), ...(isDev ? ["ws:", "http://localhost:*", "http://127.0.0.1:*"] : [])],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives).map(([k, v]) => `${k} ${v.join(" ")}`).join("; ");
}

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@prospex/types"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
