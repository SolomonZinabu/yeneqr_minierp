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
  allowedDevOrigins: [
    ".space-z.ai",
    ".space.chatglm.site",
  ],
  serverExternalPackages: ["@prisma/client", "better-auth", "embedded-postgres"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default nextConfig;
