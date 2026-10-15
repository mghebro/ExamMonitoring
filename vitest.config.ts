import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**", "**/.next/**"],
    alias: {
      "@exam-monitor/config": path.resolve(__dirname, "./packages/config/src"),
      "@exam-monitor/shared": path.resolve(__dirname, "./packages/shared/src"),
      "@exam-monitor/database": path.resolve(__dirname, "./packages/database/src"),
      "@exam-monitor/exam-provider": path.resolve(__dirname, "./packages/exam-provider/src"),
      "@exam-monitor/notifications": path.resolve(__dirname, "./packages/notifications/src"),
    },
  },
});
