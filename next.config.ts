// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // Proxy for Discovery (Production)
        source: "/kalshi-prod/:path*",
        destination: "https://api.elections.kalshi.com/trade-api/v2/:path*",
      },
      {
        // Proxy for Trading (Demo)
        source: "/kalshi-demo/:path*",
        destination: "https://demo-api.kalshi.co/trade-api/v2/:path*",
      },
    ];
  },
  typescript: {
    
    ignoreBuildErrors: true,
  },
};

export default nextConfig;