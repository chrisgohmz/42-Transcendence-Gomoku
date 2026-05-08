import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const shouldStartWebServer =
  process.env["PLAYWRIGHT_SKIP_WEB_SERVER"] !== "1" && !process.env["PLAYWRIGHT_BASE_URL"];
const webServerCommand =
  process.env["PLAYWRIGHT_WEB_SERVER_COMMAND"] ??
  (process.env["CI"] ? "bun run build && bun run start" : "bun run dev");

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env["CI"]),
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : 2,
  reporter: process.env["CI"]
    ? [["github"], ["html", { open: "never" }]]
    : [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  webServer: shouldStartWebServer
    ? {
        command: webServerCommand,
        reuseExistingServer: !process.env["CI"],
        stderr: "pipe",
        stdout: "pipe",
        timeout: 120_000,
        url: baseURL,
      }
    : undefined,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
