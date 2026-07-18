import { expect, test, type Page } from '@playwright/test'

/**
 * API-error UI states. This spec runs only in the `error-states` project,
 * whose dev server is built with VITE_API_BASE_URL set — so the client really
 * calls fetch() and every /api/ request below is intercepted, never sent.
 *
 * The client (src/api/client.ts) retries once after 1.5 s on status 0/503 and
 * never on 429; these tests pin both the retry behavior and the Croatian copy.
 * The 30 s timeout path is covered in src/api/client.test.ts (fake timers).
 */

const MENTOR_RESPONSE = {
  query: 'test',
  results: [
    {
      mentor_id: 1,
      full_name: 'Testni Mentor',
      zavod_code: 'ZEMRIS',
      score: 0.91,
      n_theses: 3,
      evidence: [
        {
          id: 1,
          title: 'Testni diplomski rad',
          year: 2025,
          thesis_type: 'diplomski',
          similarity: 0.88,
          url: null,
        },
      ],
      current_topics: [],
      matched_keywords: ['test'],
      explanation: 'Testno objašnjenje.',
    },
  ],
}

// Must match the VITE_API_BASE_URL the :5274 dev server is started with
// (playwright.config.ts). Routes are scoped to this origin — a bare '**/api/**'
// would also swallow Vite's own module requests like /src/api/client.ts.
const API_ORIGIN = 'http://127.0.0.1:9999'

test.beforeEach(async ({ page }) => {
  // Fulfill the side endpoints so the page loads cleanly; anything unmatched
  // must not escape to the (nonexistent) API origin.
  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const url = route.request().url()
    const json = (body: unknown) => route.fulfill({ status: 200, json: body })
    if (url.includes('/api/zavodi')) return json([])
    if (url.includes('/api/meta')) return json({ sources: [] })
    if (url.includes('/api/programmes')) return json({ programmes: [] })
    if (url.includes('/api/health')) return json({ status: 'ok' })
    return route.fulfill({ status: 404, json: { detail: 'not found' } })
  })
})

async function submitSearch(page: Page, query = 'računalni vid') {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill(query)
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()
}

const ERROR_TITLE = 'Došlo je do pogreške pri pretraživanju'

test('the real-API footer line is shown', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Povezano s repozitorijem FER-a')).toBeVisible()
})

test('429 shows the rate-limit message and is not retried', async ({ page }) => {
  let calls = 0
  await page.route(`${API_ORIGIN}/api/recommend`, async (route) => {
    calls++
    await route.fulfill({ status: 429, json: { detail: 'rate limited' } })
  })

  await submitSearch(page)

  await expect(page.getByText(ERROR_TITLE)).toBeVisible()
  await expect(page.getByText('Previše upita — pričekaj minutu.')).toBeVisible()
  // A rate-limited request must not be retried — that would add load.
  expect(calls).toBe(1)
})

test('503 is retried once, then recovers via „Pokušaj ponovno“', async ({ page }) => {
  let calls = 0
  await page.route(`${API_ORIGIN}/api/recommend`, async (route) => {
    calls++
    if (calls <= 2) {
      await route.fulfill({ status: 503, json: {} })
    } else {
      await route.fulfill({ status: 200, json: MENTOR_RESPONSE })
    }
  })

  await submitSearch(page)

  // First attempt 503 → automatic retry after ~1.5 s → second 503 → error UI.
  await expect(page.getByText(ERROR_TITLE)).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByText('Trenutačno je gužva na poslužitelju. Pokušaj ponovno za koji trenutak.'),
  ).toBeVisible()
  expect(calls).toBe(2)

  // Manual retry hits the now-"recovered" server and renders results.
  await page.getByRole('button', { name: 'Pokušaj ponovno' }).click()
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Testni Mentor' })).toBeVisible()
  expect(calls).toBe(3)
})

test('a network failure is retried once, then reported', async ({ page }) => {
  let calls = 0
  await page.route(`${API_ORIGIN}/api/recommend`, async (route) => {
    calls++
    await route.abort('failed')
  })

  await submitSearch(page)

  await expect(page.getByText(ERROR_TITLE)).toBeVisible({ timeout: 10_000 })
  await expect(
    page.getByText('Ne mogu se spojiti na poslužitelj. Pokušaj ponovno za nekoliko trenutaka.'),
  ).toBeVisible()
  expect(calls).toBe(2)
})

test('a 500 with no detail shows the generic server-error message', async ({ page }) => {
  await page.route(`${API_ORIGIN}/api/recommend`, (route) =>
    route.fulfill({ status: 500, json: {} }),
  )

  await submitSearch(page)

  await expect(page.getByText(ERROR_TITLE)).toBeVisible()
  await expect(
    page.getByText('Poslužitelj je javio pogrešku. Pokušaj ponovno za nekoliko trenutaka.'),
  ).toBeVisible()
})
