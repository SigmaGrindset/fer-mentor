import { expect, test } from '@playwright/test'

/**
 * Elective-course recommender flow (/izborni) against the mock API layer.
 * The catalogue auto-selects the first programme of the active level once it
 * loads, so the happy path only needs an interest description.
 */

test('electives: submit stays disabled until an interest is typed', async ({ page }) => {
  await page.goto('/izborni')
  const submit = page.getByRole('button', { name: 'Pronađi izborne' })
  await expect(submit).toBeDisabled()

  await page.getByLabel('Opiši svoj interes').fill('strojno učenje i obrada slike')
  await expect(submit).toBeEnabled()
})

test('electives: search renders ranked courses', async ({ page }) => {
  await page.goto('/izborni')

  // Wait for the catalogue: the programme select shows the default programme.
  await expect(page.getByRole('button', { name: 'Smjer' })).toContainText('Računarstvo')

  await page.getByLabel('Opiši svoj interes').fill('strojno učenje i obrada slike')
  await page.getByRole('button', { name: 'Pronađi izborne' }).click()

  await expect(
    page.getByRole('heading', { name: 'Predloženi izborni predmeti' }),
  ).toBeVisible()
  await expect(page.getByText('za interes „strojno učenje i obrada slike“')).toBeVisible()
  await expect(page.getByText('Duboko učenje').first()).toBeVisible()
})

test('electives: switching to diplomski offers profiles grouped by area', async ({ page }) => {
  await page.goto('/izborni')
  await page.getByRole('button', { name: 'diplomski', exact: true }).click()

  const profileSelect = page.getByRole('button', { name: 'Profil diplomskog studija' })
  await expect(profileSelect).toBeVisible()
  await profileSelect.click()

  const listbox = page.getByRole('listbox', { name: 'Profil diplomskog studija' })
  await expect(listbox).toBeVisible()
  await expect(listbox.getByRole('option', { name: 'Znanost o podacima' })).toBeVisible()

  await listbox.getByRole('option', { name: 'Znanost o podacima' }).click()
  await expect(profileSelect).toContainText('Znanost o podacima')

  await page.getByLabel('Opiši svoj interes').fill('analiza podataka i strojno učenje')
  await page.getByRole('button', { name: 'Pronađi izborne' }).click()
  await expect(
    page.getByRole('heading', { name: 'Predloženi izborni predmeti' }),
  ).toBeVisible()
})
