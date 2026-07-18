import { expect, test } from '@playwright/test'

/**
 * Core mentor-search flow against the mock API layer, exercised on both the
 * desktop and mobile projects (see playwright.config.ts).
 */

test('search → results → mentor profile', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByText('Spremni za pretragu')).toBeVisible()

  await page.getByLabel('Opiši temu').fill('računalni vid i prepoznavanje objekata')
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()

  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()
  await expect(
    page.getByText('za temu „računalni vid i prepoznavanje objekata“'),
  ).toBeVisible()

  const mentorLink = page.getByRole('link', { name: 'Ivana Kovačević' }).first()
  await mentorLink.click()
  await expect(page).toHaveURL(/\/mentor\/\d+/)
  await expect(
    page.getByRole('heading', { level: 1, name: /Ivana Kovačević/ }),
  ).toBeVisible()
})

test('bookmarking a mentor updates the nav badge and the saved page', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill('računalni vid')
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  await page.getByRole('button', { name: 'Spremi: Ivana Kovačević' }).click()

  // Both navs (desktop header / mobile bottom bar) show the saved count.
  const savedNav = page.locator('a[href="/spremljeni"]:visible').first()
  await expect(savedNav).toContainText('1')

  await savedNav.click()
  await expect(page).toHaveURL(/\/spremljeni/)
  await expect(page.getByText('Ivana Kovačević').first()).toBeVisible()
})

test('nonsense query shows the empty-results state', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill('xyzxyzxyz')
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()
  await expect(page.getByText('Nema pronađenih mentora')).toBeVisible()
})

test('mock mode is labeled in the footer', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Demo podatci (mock)')).toBeVisible()
})
