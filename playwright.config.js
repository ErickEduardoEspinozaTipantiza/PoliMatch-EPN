import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const edgeInstalled =
  process.platform === "win32" &&
  [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].some(existsSync);

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./tests/e2e/artifacts/results",
  fullyParallel: true,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "./tests/e2e/artifacts/results/report.json" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:5178",
    browserName: "chromium",
    ...(edgeInstalled ? { channel: "msedge" } : {}),
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
    locale: "es-CO",
    timezoneId: "America/Bogota",
  },
  projects: [
    {
      name: "desktop-fixtures",
      use: { viewport: { width: 1440, height: 1000 } },
    },
    {
      name: "mobile-390-fixtures",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "mobile-320-fixtures",
      use: {
        viewport: { width: 320, height: 740 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command:
      "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort",
    cwd: fileURLToPath(new URL("./client", import.meta.url)),
    env: { VITE_API_URL: "/api", VITE_SOCKET_URL: "http://127.0.0.1:5178" },
    url: "http://127.0.0.1:5178",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
