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
};

export default nextConfig;
