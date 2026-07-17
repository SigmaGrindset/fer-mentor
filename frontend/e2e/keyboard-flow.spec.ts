import { expect, test } from '@playwright/test'

/**
 * Keyboard/accessibility flow: a keyboard-only user searches for a topic and
 * opens a recommended mentor's profile. No mouse events anywhere.
 * Runs against the mock API layer (see webServer env in playwright.config.ts).
 */

async function tabUntilFocused(
  page: import('@playwright/test').Page,
  locator: import('@playwright/test').Locator,
  maxTabs: number,
) {
  for (let i = 0; i < maxTabs; i++) {
    if (await locator.evaluate((el) => el === document.activeElement).catch(() => false)) {
      return
    }
    await page.keyboard.press('Tab')
  }
}

test('keyboard-only: search → results → mentor profile', async ({ page }) => {
  await page.goto('/')

  // The topic textarea must be reachable by Tab alone.
  const textarea = page.getByLabel('Opiši temu')
  await tabUntilFocused(page, textarea, 25)
  await expect(textarea).toBeFocused()

  await page.keyboard.type('računalni vid i prepoznavanje objekata')
  // The form supports Ctrl+Enter submit from the textarea.
  await page.keyboard.press('Control+Enter')

  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  // The results list is an aria-live region with mentor profile links.
  const mentorLink = page.getByRole('link', { name: 'Ivana Kovačević' }).first()
  await expect(mentorLink).toBeVisible()

  await tabUntilFocused(page, mentorLink, 60)
  await expect(mentorLink).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/mentor\/\d+/)
  await expect(
    page.getByRole('heading', { level: 1, name: /Ivana Kovačević/ }),
  ).toBeVisible()
})
