import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolves the "@/*" alias straight from tsconfig.json, so tests import
  // exactly the same module specifiers the app does.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
