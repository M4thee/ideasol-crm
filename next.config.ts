import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.50.17"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yjjqkjyzchljmvplrnpx.supabase.co",
        pathname: "/storage/v1/object/public/profit-reward-media/**",
      },
    ],
  },
  experimental: {
    proxyClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
