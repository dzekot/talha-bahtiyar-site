import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  // The scene runs on a software rasteriser in CI, where frame times are long
  // and occasionally push a timing assertion over the edge. One retry keeps a
  // slow runner from failing the deploy while a genuine break still fails twice.
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: [
            "--enable-webgl",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
          ],
        },
      },
    },
    {
      name: "webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
      },
    },
  ],
  webServer: {
    command: "pnpm preview",
    url: "http://127.0.0.1:4174",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
