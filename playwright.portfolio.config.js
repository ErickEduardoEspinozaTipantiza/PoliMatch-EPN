import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testDir: "./tests/portfolio",
  projects: [
    { name: "portfolio", use: { viewport: { width: 1440, height: 960 } } },
  ],
  workers: 1,
  timeout: 60_000,
  reporter: "list",
  outputDir: "./test-results/portfolio",
});
