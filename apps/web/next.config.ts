import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@exam-monitor/config", "@exam-monitor/shared"],
};

export default nextConfig;
