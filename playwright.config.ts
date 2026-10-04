import { defineConfig, devices } from '@playwright/test';

/**
 * Pragmatic Playwright configuration for Kylrix.
 * Optimized for local Codespace/Docker performance and non-competing server reuse.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3005',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: ['--no-sandbox', '--disable-setuid-sandbox'],
        },
      },
    },
  ],
  ...(process.env.PLAYWRIGHT_TEST_BASE_URL
    ? {}
    : {
        webServer: {
          command: 'pnpm dev',
          url: 'http://localhost:3005/api/dev/logs',
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
