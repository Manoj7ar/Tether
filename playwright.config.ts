import { defineConfig, devices } from "@playwright/test";

const supabaseUrl = "https://mock-project.supabase.co";
const supabaseKey = "mock-publishable-key";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: [
      "npx cross-env",
      "VITE_E2E_AUTH_MODE=stub",
      `VITE_SUPABASE_URL=${supabaseUrl}`,
      `VITE_SUPABASE_PUBLISHABLE_KEY=${supabaseKey}`,
      "VITE_SUPABASE_PROJECT_ID=mock-project",
      "vite --host 127.0.0.1 --port 4173",
    ].join(" "),
    port: 4173,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
