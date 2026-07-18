import { expect, test } from '@playwright/test'

/**
 * Input edge cases and URL-driven behavior on the search page (mock API).
 */

test('a 600-character paste is truncated to the 500 limit and announced', async ({ page }) => {
  await page.goto('/')
  const textarea = page.getByLabel('Opiši temu')
  await textarea.click()
  // insertText goes through the browser's input pipeline like a paste, so the
  // native maxLength applies (unlike fill(), which sets the value directly).
  await page.keyboard.insertText('a'.repeat(600))

  await expect(textarea).toHaveValue('a'.repeat(500))
  await expect(page.getByText('500/500')).toBeVisible()
  await expect(page.getByText('Dosegnut je najveći broj znakova (500).')).toBeVisible()
})

test('whitespace-only input never enables the submit button', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill('   \n  ')
  await expect(page.getByRole('button', { name: 'Pronađi mentore' })).toBeDisabled()
})

test('a query full of Croatian diacritics completes without an error state', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill('strojno učenje — čćšžđ ČĆŠŽĐ')
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()

  // Either results or the empty state is fine; an error state is not.
  await expect(
    page
      .getByRole('heading', { name: 'Predloženi mentori' })
      .or(page.getByText('Nema pronađenih mentora')),
  ).toBeVisible()
  await expect(page.getByText('Došlo je do pogreške pri pretraživanju')).toBeHidden()
})

test('?q= in the URL auto-runs the search on load', async ({ page }) => {
  await page.goto('/?q=ra%C4%8Dunalni%20vid')
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()
  await expect(page.getByText('za temu „računalni vid“')).toBeVisible()
})

test('a hand-edited ?tip= falls back to all thesis types', async ({ page }) => {
  await page.goto('/?tip=svastanesto')
  await expect(page.getByRole('button', { name: 'Svi radovi' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('recent searches: pill appears, persists, re-runs, and can be removed', async ({ page }) => {
  await page.goto('/')
  await page.getByLabel('Opiši temu').fill('računalni vid')
  await page.getByRole('button', { name: 'Pronađi mentore' }).click()
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  await expect(page.getByText('Nedavno')).toBeVisible()
  await expect(page.getByRole('button', { name: 'računalni vid', exact: true })).toBeVisible()

  // Persists across a reload (localStorage).
  await page.goto('/')
  const pill = page.getByRole('button', { name: 'računalni vid', exact: true })
  await expect(pill).toBeVisible()

  // Clicking the pill re-runs the search.
  await pill.click()
  await expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible()

  // The × forgets it.
  await page.getByRole('button', { name: 'Ukloni „računalni vid“ iz nedavnih' }).click()
  await expect(
    page.getByRole('button', { name: 'računalni vid', exact: true }),
  ).toBeHidden()
})
