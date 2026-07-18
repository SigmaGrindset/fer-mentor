import { expect, test, type Page } from '@playwright/test'

/**
 * Horizontal-overflow audit: no page may scroll sideways. Runs on both the
 * desktop and mobile projects; a narrow 320 px pass catches the tightest
 * phones the CSS must still fit.
 */

const ROUTES: { path: string; ready: (page: Page) => Promise<void> }[] = [
  {
    path: '/',
    ready: (page) =>
      expect(page.getByRole('heading', { name: 'Pronađi mentora za svoj rad.' })).toBeVisible(),
  },
  {
    // Search page with results rendered (auto-run via ?q=).
    path: '/?q=ra%C4%8Dunalni%20vid',
    ready: (page) =>
      expect(page.getByRole('heading', { name: 'Predloženi mentori' })).toBeVisible(),
  },
  {
    path: '/izborni',
    ready: (page) =>
      expect(page.getByRole('heading', { name: 'Pronađi izborne predmete.' })).toBeVisible(),
  },
  {
    path: '/mentori',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  },
  {
    path: '/mentor/1',
    ready: (page) => expect(page.getByRole('heading', { level: 1 })).toBeVisible(),
  },
  {
    path: '/spremljeni',
    ready: (page) => expect(page.getByText('Još nema spremljenih')).toBeVisible(),
  },
  {
    path: '/ne-postoji',
    ready: (page) => expect(page.getByText('Stranica nije pronađena')).toBeVisible(),
  },
]

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement
    return {
      doc: doc.scrollWidth - doc.clientWidth,
      body: document.body.scrollWidth - doc.clientWidth,
    }
  })
  expect(overflow.doc, `<html> overflows on ${label} by ${overflow.doc}px`).toBeLessThanOrEqual(1)
  expect(overflow.body, `<body> overflows on ${label} by ${overflow.body}px`).toBeLessThanOrEqual(1)
}

for (const { path, ready } of ROUTES) {
  test(`no horizontal overflow on ${path}`, async ({ page }) => {
    await page.goto(path)
    await ready(page)
    await expectNoHorizontalOverflow(page, path)
  })
}

test('no horizontal overflow at 320 px width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 660 })
  for (const { path, ready } of ROUTES) {
    await page.goto(path)
    await ready(page)
    await expectNoHorizontalOverflow(page, `${path} @320px`)
  }
})
