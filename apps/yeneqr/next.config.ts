import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  devIndicator: false,
  allowedDevOrigins: [
    ".space-z.ai",
    ".space.chatglm.site",
  ],
  // In standalone mode, Next.js doesn't serve runtime-created files from public/.
  // These rewrites route /uploads/* and /images/* requests through our file-serving API route.
  async rewrites() {
    return [
      {
        source: "/uploads/:path*",
        destination: "/api/files/uploads/:path*",
      },
      {
        source: "/images/:path*",
        destination: "/api/files/images/:path*",
      },
    ];
  },
};

export default nextConfig;
