import { expect, test } from '@playwright/test'

/**
 * UI smoke tests against the deployed site.
 *
 * Unlike the mock-mode suite in e2e/, these run against real data, so nothing
 * here asserts a specific mentor or thesis title -- that would break every time
 * FER publishes. They assert shape and behaviour: results render, links
 * resolve, the real API (not the mock layer) is in use.
 */

const QUERY = 'strojno učenje i obrada slike'

function isMobile(page: import('@playwright/test').Page) {
  return (page.viewportSize()?.width ?? 1280) < 640
}

test('home page loads and is running against the REAL api', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Spremni za pretragu')).toBeVisible()
  // The mock layer labels itself; on prod that label must be absent, otherwise
  // the deploy is serving a build with VITE_API_BASE_URL unset.
  await expect(page.getByText('Demo podatci (mock)')).toHaveCount(0)
})

test('footer shows the data-freshness date from /api/meta', async ({ page }) => {
  await page.goto('/')

  const footer = page.getByText(/Podaci ažurirani/)
  await expect(footer).toBeVisible()
  // Proves the freshness line is populated from ingest_runs rather than hidden.
  await expect(footer).toContainText(/20\d\d/)
  console.log('freshness:', (await footer.textContent())?.trim())
})

test('real search returns ranked mentors with evidence', async ({ page }) => {
  await page.goto('/')

  await page.getByLabel('Opiši temu').fill(QUERY)
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()

  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  const mentorLinks = page.locator('a[href^="/mentor/"]')
  expect(await mentorLinks.count()).toBeGreaterThan(0)
})

test('a result links through to a working mentor profile', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill(QUERY)
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  await page.locator('a[href^="/mentor/"]').first().click()

  await expect(page).toHaveURL(/\/mentor\/\d+/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('browse page lists real mentors', async ({ page }) => {
  await page.goto('/mentori')
  await expect(page.locator('a[href^="/mentor/"]').first()).toBeVisible()
})

test('electives page loads', async ({ page }) => {
  await page.goto('/izborni')
  await expect(
    page.getByRole('heading', { name: 'Pronađi izborne predmete.' }),
  ).toBeVisible()
})

test('unknown routes render the 404 page', async ({ page }) => {
  // The SPA rewrite answers 200 text/html for ANY path, so this must be
  // asserted on rendered content, never on the status code.
  await page.goto('/ne-postoji-stvarno')
  await expect(page.getByRole('heading', { name: /404|nije pronađena/i })).toBeVisible()
})

test('no horizontal overflow at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
})

test('theme toggle persists across a reload', async ({ page }) => {
  await page.goto('/')
  const before = await page.evaluate(() => document.documentElement.className)

  // aria-label is "Uključi tamnu temu" / "Uključi svijetlu temu", so match on
  // "temu" to stay direction-agnostic (the site may start in either theme).
  await page.locator('button[aria-label*="temu"]:visible').first().click()
  const after = await page.evaluate(() => document.documentElement.className)
  expect(after).not.toBe(before)

  await page.reload()
  await expect
    .poll(() => page.evaluate(() => document.documentElement.className))
    .toBe(after)
})

test('mobile bottom nav is present only on small viewports', async ({ page }) => {
  await page.goto('/')
  const bottomNav = page.getByRole('navigation', { name: 'Glavna navigacija' })

  if (isMobile(page)) {
    await expect(bottomNav).toBeVisible()
  } else {
    await expect(bottomNav).toBeHidden()
  }
})
