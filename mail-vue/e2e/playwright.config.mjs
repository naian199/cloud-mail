import { defineConfig, devices } from '@playwright/test';
import { READY_PORT } from './env.mjs';

// Run with `pnpm test:e2e` from mail-vue. The first run builds the frontend;
// set E2E_SKIP_BUILD=1 to reuse the last build.
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'off',
    // The service worker calls the Badge API, which headless Chromium lacks; it is not under test here.
    serviceWorkers: 'block'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['iPhone 13'], browserName: 'chromium' } }
  ],
  webServer: {
    command: 'node e2e/server.mjs',
    cwd: '..',
    url: `http://127.0.0.1:${READY_PORT}`,
    timeout: 600_000,
    reuseExistingServer: false,
    stdout: 'pipe'
  }
});
