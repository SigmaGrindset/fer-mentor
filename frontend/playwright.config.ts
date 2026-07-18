import { defineConfig, devices } from '@playwright/test'

// Dedicated e2e ports (with --strictPort) so a developer's normal `npm run
// dev` on 5173 — possibly pointed at a real backend via .env — is never
// reused for tests.
const MOCK_URL = 'http://localhost:5273'
const REAL_API_BUILD_URL = 'http://localhost:5274'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: MOCK_URL,
  },
  projects: [
    // Desktop and mobile run the same mock-mode specs; error-states needs the
    // real-API build (see below) so page.route can intercept fetch.
    {
      name: 'desktop',
      testIgnore: /error-states/,
      use: { browserName: 'chromium' },
    },
    {
      // Chromium-based emulation — no extra browser download. keyboard-flow is
      // a desktop-only tab-order scenario, so it is skipped here.
      name: 'mobile',
      testIgnore: /error-states|keyboard-flow/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'error-states',
      testMatch: /error-states/,
      use: { browserName: 'chromium', baseURL: REAL_API_BUILD_URL },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5273 --strictPort',
      url: MOCK_URL,
      reuseExistingServer: !process.env.CI,
      // Force mock mode regardless of any local .env, so the e2e run needs no
      // backend or database.
      env: { VITE_API_BASE_URL: '' },
    },
    {
      command: 'npm run dev -- --port 5274 --strictPort',
      url: REAL_API_BUILD_URL,
      reuseExistingServer: !process.env.CI,
      // Real-API mode so the client actually calls fetch(). The origin is
      // never reached: error-states specs intercept every /api/ request.
      env: { VITE_API_BASE_URL: 'http://127.0.0.1:9999' },
    },
  ],
})
