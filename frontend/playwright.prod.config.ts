import { defineConfig, devices } from '@playwright/test'

/**
 * Smoke tests against the DEPLOYED site (Vercel frontend + Hugging Face API +
 * Neon), as opposed to playwright.config.ts which forces mock mode and never
 * leaves localhost.
 *
 * Deliberately kept separate:
 *  - `testDir` here is e2e-prod/, so the default config (testDir: './e2e') and
 *    therefore CI never runs these against production.
 *  - `workers: 1` and no retries on the API-heavy specs: the backend rate-limits
 *    to 15 requests/min per IP, and a parallel run would trip it and report a
 *    429 as a product failure.
 *  - Long timeouts: the free Space sleeps after 48 h idle and needs ~35-60 s to
 *    load bge-m3 on the first request.
 *
 *   npx playwright test --config=playwright.prod.config.ts
 */
const PROD_URL = process.env.PROD_URL ?? 'https://fermentor.vercel.app'

export default defineConfig({
  testDir: './e2e-prod',
  timeout: 120_000,
  expect: { timeout: 60_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: PROD_URL,
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
  },
  projects: [
    { name: 'prod-desktop', use: { browserName: 'chromium' } },
    { name: 'prod-mobile', use: { ...devices['Pixel 7'] } },
  ],
})
