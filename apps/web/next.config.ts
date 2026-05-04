import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@grc/ui"],
  experimental: {
    // Turbopack is enabled via --turbopack flag in dev script
  },
};

export default nextConfig;
