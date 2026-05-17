// Playwright config — Phase 1 / PR5 (REQ-PLAY-01, DEC-011).
// - workers: 1 in CI to stay under Supabase free-tier rate limits during fixture seed.
// - retries: 2 in CI to absorb Alpine.js `defer` boot races.
// - screenshot/video: only-on-failure to keep artifact size small.
// - webServer.timeout: 15s — index.html still references the 4.7MB MP4 until PR0.
// - chromium-only — multi-browser adds 3x CI time without benefit at family-tier scale.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
  ],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npx serve . -l 3000 --no-clipboard',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
