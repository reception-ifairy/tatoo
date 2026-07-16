import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mysql2"],
  poweredByHeader: false,
};

export default nextConfig;
