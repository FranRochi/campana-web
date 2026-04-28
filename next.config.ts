import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL;
    if (!backendUrl) return [];
    return [
      {
        source: "/static/:path*",
        destination: `${backendUrl}/static/:path*`,
      },
    ];
  },
};

export default nextConfig;
