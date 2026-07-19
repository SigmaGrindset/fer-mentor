import { expect, test } from '@playwright/test'

/**
 * Contract checks straight against the deployed API (Hugging Face Space), which
 * the mock-mode suite in e2e/ never touches.
 *
 * These run in the same worker as the UI specs (workers: 1) so the combined run
 * stays under the backend's 15 req/min per-IP rate limit.
 */

const API = process.env.PROD_API_URL ?? 'https://inoni7-fermentor-api.hf.space'

test('GET /api/health is ok', async ({ request }) => {
  const res = await request.get(`${API}/api/health`, { timeout: 90_000 })
  expect(res.status()).toBe(200)
})

test('GET /api/meta reports every source as a successful ingest', async ({ request }) => {
  const res = await request.get(`${API}/api/meta`, { timeout: 90_000 })
  expect(res.status()).toBe(200)

  const { sources } = await res.json()
  const names = sources.map((s: { source: string }) => s.source).sort()
  expect(names).toEqual([
    'course_embeddings',
    'courses',
    'repo',
    'schedule',
    'thesis_embeddings',
  ])

  for (const s of sources) {
    expect(s.records_upserted, `${s.source} upserted`).toBeGreaterThan(0)
  }

  const newest = sources
    .map((s: { finished_at: string }) => s.finished_at)
    .sort()
    .at(-1)
  console.log('newest ingest:', newest)
  // The July refresh must be the newest run, not the June seed.
  expect(newest >= '2026-07-18').toBe(true)
})

test('POST /api/recommend returns ranked mentors with evidence', async ({ request }) => {
  const res = await request.post(`${API}/api/recommend`, {
    data: { query: 'strojno učenje i obrada slike', top_k: 5 },
    timeout: 120_000,
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  expect(body.results.length).toBeGreaterThan(0)

  const top = body.results[0]
  expect(top.full_name).toBeTruthy()
  expect(top.score).toBeGreaterThan(0)
  expect(top.evidence.length).toBeGreaterThan(0)
  expect(top.explanation).toBeTruthy()

  // Ranking must be monotonically non-increasing.
  const scores = body.results.map((r: { score: number }) => r.score)
  expect([...scores].sort((a, b) => b - a)).toEqual(scores)
})

test('the July data is actually queryable end to end', async ({ request }) => {
  // A topic that only newly-ingested theses cover; if the Neon sync had not
  // landed, this returns unrelated mentors with no 2026 evidence.
  const res = await request.post(`${API}/api/recommend`, {
    data: { query: 'transkripcija medicinskog razgovora i podrška liječniku', top_k: 5 },
    timeout: 120_000,
  })
  expect(res.status()).toBe(200)

  const body = await res.json()
  const years = body.results.flatMap((r: { evidence: { year: number }[] }) =>
    r.evidence.map((e) => e.year),
  )
  expect(Math.max(...years)).toBe(2026)
})

test('a malformed body is rejected with 422, not a 500', async ({ request }) => {
  const res = await request.post(`${API}/api/recommend`, {
    data: { query: '', top_k: 5 },
    timeout: 90_000,
  })
  expect(res.status()).toBe(422)
})
