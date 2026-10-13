import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@prospex/types"],
  poweredByHeader: false,
  async headers() {
    // Baseline hardening. A strict CSP is intentionally not set: map tiles and reference thumbnails are third-party images.
    return [
      {
        source: "/:path*",
        headers: [
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
