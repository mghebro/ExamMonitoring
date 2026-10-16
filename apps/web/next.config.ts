import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@exam-monitor/config", "@exam-monitor/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  async rewrites() {
    const apiTarget = process.env.API_BASE_URL || "http://127.0.0.1:3001";
    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiTarget}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
