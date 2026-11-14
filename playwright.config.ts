import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60000,
  use: { baseURL: "http://localhost:3000", screenshot: "only-on-failure" },
  webServer: [
    { command: "npm run start", url: "http://localhost:3000", reuseExistingServer: true, timeout: 60000 },
    { command: "npm run api", url: "http://localhost:8000/docs", reuseExistingServer: true, timeout: 60000 },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
