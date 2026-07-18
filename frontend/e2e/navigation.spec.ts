import { expect, test } from '@playwright/test'

/**
 * Navigation chrome across viewports: the mobile bottom bar and desktop header
 * nav must swap at the sm: breakpoint (640 px), the theme toggle must persist,
 * and unknown routes must land on the 404 page.
 */

function isMobileViewport(page: import('@playwright/test').Page) {
  return (page.viewportSize()?.width ?? 1280) < 640
}

test('the correct nav is shown for the viewport', async ({ page }) => {
  await page.goto('/')
  const bottomNav = page.getByRole('navigation', { name: 'Glavna navigacija' })
  const desktopLink = page.getByRole('link', { name: 'Izborni predmeti' })

  if (isMobileViewport(page)) {
    await expect(bottomNav).toBeVisible()
    await expect(desktopLink).toBeHidden()
  } else {
    await expect(bottomNav).toBeHidden()
    await expect(desktopLink).toBeVisible()
  }
})

test('every nav destination is reachable', async ({ page }) => {
  await page.goto('/')
  const mobile = isMobileViewport(page)
  const nav = mobile
    ? page.getByRole('navigation', { name: 'Glavna navigacija' })
    : page.locator('header')

  await nav.getByRole('link', { name: mobile ? 'Izborni' : 'Izborni predmeti' }).click()
  await expect(page).toHaveURL(/\/izborni/)
  await expect(page.getByRole('heading', { name: 'Pronađi izborne predmete.' })).toBeVisible()

  await nav.getByRole('link', { name: 'Mentori' }).click()
  await expect(page).toHaveURL(/\/mentori/)

  await nav.getByRole('link', { name: 'Spremljeni' }).click()
  await expect(page).toHaveURL(/\/spremljeni/)
  await expect(page.getByText('Još nema spremljenih')).toBeVisible()

  await nav.getByRole('link', { name: 'Pretraga' }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: 'Pronađi mentora za svoj rad.' })).toBeVisible()
})

test('theme toggle switches to dark and survives a reload', async ({ page }) => {
  await page.goto('/')
  await page.locator('button[aria-label="Uključi tamnu temu"]:visible').click()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)

  await page.locator('button[aria-label="Uključi svijetlu temu"]:visible').click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)
})

test('unknown routes render the 404 page', async ({ page }) => {
  await page.goto('/ova-stranica-ne-postoji')
  await expect(page.getByText('Stranica nije pronađena')).toBeVisible()
  await page.getByRole('link', { name: 'Natrag na početnu' }).click()
  await expect(page.getByRole('heading', { name: 'Pronađi mentora za svoj rad.' })).toBeVisible()
})
