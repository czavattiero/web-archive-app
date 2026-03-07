import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  experimental: {
    serverActions: {
      allowedOrigins: ["*"],
    },
  },

  typescript: {
    ignoreBuildErrors: true,
  },

  eslint: {
    ignoreDuringBuilds: true,
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "x-render-mode",
            value: "dynamic",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
