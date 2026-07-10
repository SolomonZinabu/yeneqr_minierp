import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  reactStrictMode: false,
  allowedDevOrigins: [".space-z.ai", ".space.chatglm.site"],
  serverExternalPackages: ["@prisma/client", "better-auth", "embedded-postgres", "bcryptjs"],
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
