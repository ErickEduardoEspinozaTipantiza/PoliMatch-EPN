import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

const edgeInstalled =
  process.platform === "win32" &&
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].some(existsSync);

export default defineConfig({
  testDir: "./tests/fullstack",
  testMatch: "**/*.spec.js",
  outputDir: "./test-results/fullstack",
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5179",
    browserName: "chromium",
    ...(edgeInstalled ? { channel: "msedge" } : {}),
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  webServer: {
    command: "node tests/fullstack/server.js",
    url: "http://127.0.0.1:5179/api/health",
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 10_000 },
  },
});
