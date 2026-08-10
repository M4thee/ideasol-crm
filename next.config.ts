import type { NextConfig } from "next";

type ExtendedNextConfig = NextConfig & {
  experimental?: NonNullable<NextConfig["experimental"]> & {
    middlewareClientMaxBodySize?: string;
  };
};

const nextConfig: ExtendedNextConfig = {
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
    middlewareClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
