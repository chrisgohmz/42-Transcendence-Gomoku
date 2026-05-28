import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const shouldStartWebServer =
  process.env["PLAYWRIGHT_SKIP_WEB_SERVER"] !== "1" && !process.env["PLAYWRIGHT_BASE_URL"];
const webServerCommand =
  process.env["PLAYWRIGHT_WEB_SERVER_COMMAND"] ??
  (process.env["CI"] ? "bun run build && bun run start" : "bun run dev");
const realtimeServerCommand =
  process.env["PLAYWRIGHT_REALTIME_SERVER_COMMAND"] ?? "bun run dev:realtime";
const realtimeURL = process.env["PLAYWRIGHT_REALTIME_URL"] ?? "http://localhost:3001/health";
const webServerEnv: Record<string, string> = Object.fromEntries(
  Object.entries(process.env).filter((entry): entry is [string, string] => Boolean(entry[1])),
);

webServerEnv["GITHUB_CLIENT_ID"] ||= "playwright-github-client";
webServerEnv["GITHUB_CLIENT_SECRET"] ||= "playwright-github-secret";
webServerEnv["GOOGLE_CLIENT_ID"] ||= "playwright-google-client";
webServerEnv["GOOGLE_CLIENT_SECRET"] ||= "playwright-google-secret";
webServerEnv["BETTER_AUTH_SECRET"] ||= "playwright_better_auth_secret_change_me_32_chars";
webServerEnv["BETTER_AUTH_URL"] ||= baseURL;
webServerEnv["RATE_LIMIT_DISABLED"] ||= "true";
webServerEnv["REALTIME_FRIENDSHIP_INTERNAL_URL"] ||=
  "http://localhost:3001/internal/friendship-update";
webServerEnv["REALTIME_INTERNAL_SECRET"] ||= "playwright_realtime_internal_secret";
webServerEnv["REALTIME_INTERNAL_URL"] ||= "http://localhost:3001/internal/game-update";
webServerEnv["REALTIME_QUEUE_MATCHED_URL"] ||= "http://localhost:3001/internal/queue-matched";
webServerEnv["NEXT_PUBLIC_SOCKET_URL"] ||= "http://localhost:3001";
webServerEnv["SOCKET_CORS_ORIGIN"] ||= baseURL;
webServerEnv["OPERATIONS_STATUS_USERNAMES"] ||= [
  "e2e_status_operator_chrome",
  "e2e_status_operator_firefox",
  "e2e_status_operator_edge",
].join(",");

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
    ? [
        {
          command: webServerCommand,
          env: webServerEnv,
          name: "next",
          reuseExistingServer: !process.env["CI"],
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: baseURL,
        },
        {
          command: realtimeServerCommand,
          env: webServerEnv,
          name: "realtime",
          reuseExistingServer: true,
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: realtimeURL,
        },
      ]
    : undefined,
  projects: [
    {
      name: "chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
  ],
});
