import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicators: false,
  // Domain suffix patterns — matches ANY subdomain of space-z.ai
  // (preview-chat-xxx.space-z.ai, preview-xxx.space-z.ai, etc.)
  // MUST include both the full domain AND the dot-prefix variant for Next.js 16.
  allowedDevOrigins: [
    "preview-chat-26505d12-318a-43b2-86ad-83f6e2e08e99.space-z.ai",
    ".space-z.ai",
    ".space.chatglm.site",
    "preview-chat-26505d12-318a-43b2-86ad-83f6e2e08e99.space-z.ai",
  ],
  serverExternalPackages: ["@prisma/client", "better-auth", "embedded-postgres"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
