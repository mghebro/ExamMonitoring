import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@exam-monitor/config", "@exam-monitor/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
};

export default nextConfig;
