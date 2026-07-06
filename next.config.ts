import type { NextConfig } from "next";

type ExtendedNextConfig = NextConfig & {
  experimental?: NonNullable<NextConfig["experimental"]> & {
    middlewareClientMaxBodySize?: string;
  };
};

const nextConfig: ExtendedNextConfig = {
  allowedDevOrigins: ["192.168.50.17"],
  experimental: {
    middlewareClientMaxBodySize: "50mb",
  },
};

export default nextConfig;
