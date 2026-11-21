import { defineConfig } from '@playwright/test';

/**
 * Browser tests for the public site. They need a running CMS with data
 * (PAYLOAD_URL) and a running frontend (E2E_BASE_URL, default: `npm run dev`).
 *
 *   npm run test:e2e
 *   CHROME_EXE=/usr/bin/chromium npm run test:e2e   # use a system browser
 */
export default defineConfig({
  // tests/e2e needs a running site; tests/unit runs in Node only.
  testDir: './tests',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4321',
    viewport: { width: 1280, height: 900 },
    launchOptions: process.env.CHROME_EXE
      ? { executablePath: process.env.CHROME_EXE, args: ['--headless=new'] }
      : {},
  },
});
