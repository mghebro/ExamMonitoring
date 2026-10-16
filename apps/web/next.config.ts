import type { NextConfig } from "next";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load root .env into Next.js in this monorepo
const rootEnv = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnv)) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(rootEnv);
    } else {
      const content = fs.readFileSync(rootEnv, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Ignore error loading env file
  }
}

// Fallback aliases if NEXT_PUBLIC_* prefix was omitted in root .env
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.SUPABASE_URL;
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && process.env.SUPABASE_ANON_KEY) {
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@exam-monitor/config", "@exam-monitor/shared"],
  outputFileTracingRoot: path.join(__dirname, "../../"),
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
  },
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
