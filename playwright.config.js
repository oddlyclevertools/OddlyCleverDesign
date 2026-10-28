import { defineConfig } from "@playwright/test";

// End-to-end tests run the real app in Chrome (the system install, so nothing extra downloads).
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5182/",
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    launchOptions: { executablePath: process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe" },
    acceptDownloads: true,
  },
  webServer: {
    command: "npx vite --port 5182 --strictPort",
    url: "http://localhost:5182/",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
