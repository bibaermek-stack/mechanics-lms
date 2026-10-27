import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests cover the pure logic — physics, statistics, CSV, the cohort
// builder — so they run in plain Node with no DOM and no browser.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
