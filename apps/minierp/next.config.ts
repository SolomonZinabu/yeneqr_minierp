import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // STRICT type-safety: do NOT ignore build errors
  typescript: {
    ignoreBuildErrors: false,
  },
  // Allow Prisma to be bundled correctly
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // External packages that should not be bundled
  serverExternalPackages: ["@prisma/client", "better-auth", "embedded-postgres"],

  // ── Dev-mode cross-origin access ───────────────────────────────────────
  // Next.js 16 blocks cross-origin requests in dev mode unless the origin is
  // explicitly allowed. The Z.ai preview proxy serves the app from
  // https://preview-*.space-z.ai which is a different origin than localhost:3000.
  // Without this, the browser gets "Failed to fetch RSC payload" on every
  // client-side navigation (including after sign-in), causing redirect loops.
  allowedDevOrigins: [
    "https://preview-chat-26505d12-318a-43b2-86ad-83f6e2e08e99.space-z.ai",
    // Wildcard pattern isn't supported by Next.js, so we add the specific
    // preview domain. For other preview subdomains, add them here or use
    // the TRUSTED_ORIGINS env var pattern.
  ],
};

export default nextConfig;
