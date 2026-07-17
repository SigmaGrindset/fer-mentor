/**
 * Mock API layer. Mirrors the backend contract (core/schemas.py) so the UI can
 * run with no backend. `recommend` does a naive keyword-overlap match against
 * the query so the demo ranking feels real.
 *
 * Swap to the real backend by setting VITE_API_BASE_URL (see src/api/client.ts).
 */
import { MOCK_MENTORS, type MockMentor, type MockThesis } from './mockData'
import type {
  EvidenceThesis,
  HealthResponse,
  MentorDetail,
  MentorListResponse,
  MentorRecommendation,
  MentorSort,
  MentorSummary,
  RecommendRequest,
  RecommendResponse,
  SimilarMentor,
  ThesisOut,
  ZavodOut,
} from './types'

/** Simulate network latency so loading states are visible in the demo. */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Croatian-aware-ish tokenizer: lowercase, strip punctuation, split on space. */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)
}

const STOPWORDS = new Set([
  'koji',
  'koja',
  'koje',
  'sustav',
  'razvoj',
  'analiza',
  'primjena',
  'pomocu',
  'pomoću',
  'temelju',
  'temelji',
  'rad',
  'tema',
  'zelim',
  'želim',
  'raditi',
  'htio',
  'htjela',
  'bih',
  'kako',
  'sto',
  'što',
  'nesto',
  'nešto',
])

/**
 * Normalize a thesis type for comparison: mock data uses 'završni' (diacritic)
 * while the API contract uses ASCII 'zavrsni'.
 */
function normalizeType(s?: string | null): string {
  return (s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/** Text that represents a thesis for matching purposes. */
function thesisText(t: MockThesis): string {
  return [t.title, t.scientific_field ?? '', t.keywords.join(' '), t.abstract ?? ''].join(' ')
}

/**
 * Score a single thesis against the query tokens: fraction of query tokens that
 * appear in the thesis text, with a small boost for keyword/field hits.
 * Returns a pseudo-cosine similarity in 0..1.
 */
function scoreThesis(queryTokens: string[], t: MockThesis): number {
  if (queryTokens.length === 0) return 0
  const haystack = tokenize(thesisText(t))
  const haystackSet = new Set(haystack)
  const keywordTokens = new Set(tokenize(t.keywords.join(' ') + ' ' + (t.scientific_field ?? '')))

  let hits = 0
  let weighted = 0
  for (const q of queryTokens) {
    if (haystackSet.has(q)) {
      hits += 1
      weighted += keywordTokens.has(q) ? 1.5 : 1
    }
  }
  if (hits === 0) return 0
  const coverage = weighted / (queryTokens.length * 1.5)
  // Map into a believable similarity band (0.45..0.95).
  return Math.min(0.95, 0.45 + coverage * 0.5)
}

/** Keyword phrases (from the theses) that share a token with the query. */
function matchedKeywords(queryTokens: string[], theses: MockThesis[]): string[] {
  const qset = new Set(queryTokens)
  const out: string[] = []
  const seen = new Set<string>()
  for (const t of theses) {
    for (const kw of t.keywords) {
      const key = kw.toLowerCase()
      if (seen.has(key)) continue
      if (tokenize(kw).some((kt) => qset.has(kt))) {
        seen.add(key)
        out.push(kw)
      }
    }
  }
  return out
}

function buildExplanation(
  mentor: MockMentor,
  evidence: EvidenceThesis[],
  matched: string[],
  matchedFields: string[],
): string {
  const n = evidence.length
  const radWord = n === 1 ? 'rad' : n < 5 ? 'rada' : 'radova'
  const top = evidence[0]
  const god = top?.year ? ` (${top.year})` : ''
  if (matched.length > 0) {
    const pojmovi = matched
      .slice(0, 3)
      .map((t) => `„${t}”`)
      .join(', ')
    const npr = top ? ` — npr. „${top.title}”${god}` : ''
    return `Preporučeno jer ${mentor.full_name} ima ${n} ${radWord} koji dijele pojmove ${pojmovi}${npr}.`
  }
  const fieldText =
    matchedFields.length > 0
      ? `iz područja ${matchedFields.slice(0, 2).join(' i ')}`
      : 'iz srodnih područja'
  return `${mentor.full_name} mentorira ${n} ${radWord} ${fieldText} koji se podudaraju s tvojom temom.`
}

function toEvidence(t: MockThesis, similarity: number): EvidenceThesis {
  return {
    id: t.id,
    title: t.title,
    year: t.year,
    thesis_type: t.thesis_type,
    similarity,
    url: t.url,
  }
}

function toThesisOut(t: MockThesis): ThesisOut {
  return {
    id: t.id,
    title: t.title,
    year: t.year,
    thesis_type: t.thesis_type,
    scientific_field: t.scientific_field,
    keywords: t.keywords,
    source: t.source,
    url: t.url,
  }
}

function toSummary(m: MockMentor): MentorSummary {
  return {
    id: m.id,
    full_name: m.full_name,
    zavod_code: m.zavod_code,
    // Repo theses + current-year schedule topics, matching the backend's count.
    n_theses: m.theses.length + m.current_topics.length,
  }
}

export async function mockRecommend(req: RecommendRequest): Promise<RecommendResponse> {
  await delay(550)
  const topK = req.top_k ?? 10
  const rawTokens = tokenize(req.query)
  const queryTokens = rawTokens.filter((t) => !STOPWORDS.has(t))
  const effectiveTokens = queryTokens.length > 0 ? queryTokens : rawTokens

  let candidates = MOCK_MENTORS
  if (req.zavod) {
    candidates = candidates.filter((m) => m.zavod_code === req.zavod)
  }
  if (req.field) {
    const f = req.field.toLowerCase()
    candidates = candidates.filter((m) =>
      m.scientific_fields.some((sf) => sf.toLowerCase().includes(f)),
    )
  }

  // Hard filter (parity with the backend): only theses of the requested type
  // score, show as evidence, and keep a mentor in the results.
  const wantType = req.thesis_type ? normalizeType(req.thesis_type) : null

  const results: MentorRecommendation[] = candidates
    .map((m) => {
      const pool = wantType
        ? m.theses.filter((t) => normalizeType(t.thesis_type) === wantType)
        : m.theses
      const scored = pool
        .map((t) => ({ t, s: scoreThesis(effectiveTokens, t) }))
        .filter((x) => x.s > 0)
        .sort((a, b) => b.s - a.s)

      const evidence = scored.slice(0, 3).map((x) => toEvidence(x.t, Number(x.s.toFixed(3))))

      // Aggregated, recency-weighted score: best matches dominate, newer theses
      // weighted slightly higher.
      const now = new Date().getFullYear()
      const agg =
        scored.reduce((acc, x, i) => {
          const recency = x.t.year ? 1 + Math.max(0, 5 - (now - x.t.year)) * 0.02 : 1
          return acc + x.s * recency * Math.pow(0.6, i)
        }, 0) / Math.max(1, Math.min(scored.length, 3))

      const matchedFields = Array.from(
        new Set(scored.map((x) => x.t.scientific_field).filter((f): f is string => Boolean(f))),
      )
      const matched = matchedKeywords(
        effectiveTokens,
        scored.map((x) => x.t),
      ).slice(0, 6)

      return {
        mentor_id: m.id,
        full_name: m.full_name,
        zavod_code: m.zavod_code,
        score: Number(Math.min(0.99, agg).toFixed(3)),
        n_theses: m.theses.length + m.current_topics.length,
        evidence,
        current_topics: m.current_topics,
        matched_keywords: matched,
        explanation: buildExplanation(m, evidence, matched, matchedFields),
        _hasMatch: scored.length > 0,
      } as MentorRecommendation & { _hasMatch: boolean }
    })
    .filter((r) => r._hasMatch)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ _hasMatch: _ignored, ...rest }) => rest)

  return { query: req.query, results }
}

export async function mockGetMentor(id: number): Promise<MentorDetail> {
  await delay(350)
  const m = MOCK_MENTORS.find((x) => x.id === id)
  if (!m) {
    throw new ApiNotFound(`Mentor ${id} nije pronađen.`)
  }
  // Real-backend parity: current-year topics appear in the detail response as
  // title-only schedule-source theses. Ids sit outside the mock thesis range.
  const currentYear = new Date().getFullYear()
  const scheduleTheses: ThesisOut[] = m.current_topics.map((title, i) => ({
    id: 900000 + m.id * 100 + i,
    title,
    year: currentYear,
    thesis_type: null,
    scientific_field: null,
    keywords: [],
    source: 'schedule',
    url: null,
  }))
  const theses = [...scheduleTheses, ...m.theses.map(toThesisOut)].sort(
    (a, b) => (b.year ?? 0) - (a.year ?? 0),
  )
  return {
    id: m.id,
    full_name: m.full_name,
    zavod_code: m.zavod_code,
    scientific_fields: m.scientific_fields,
    n_theses: theses.length,
    theses,
  }
}

export async function mockGetSimilarMentors(id: number, limit = 6): Promise<SimilarMentor[]> {
  await delay(250)
  const target = MOCK_MENTORS.find((x) => x.id === id)
  if (!target) {
    throw new ApiNotFound(`Mentor ${id} nije pronađen.`)
  }
  // Demo stand-in for the backend's centroid cosine: shared scientific fields
  // plus keyword-token overlap, mapped into a believable similarity band.
  const targetFields = new Set(target.scientific_fields)
  const targetTokens = new Set(target.theses.flatMap((t) => tokenize(t.keywords.join(' '))))
  return MOCK_MENTORS.filter((m) => m.id !== id)
    .map((m) => {
      const sharedFields = m.scientific_fields.filter((f) => targetFields.has(f)).length
      const tokens = new Set(m.theses.flatMap((t) => tokenize(t.keywords.join(' '))))
      let shared = 0
      for (const t of tokens) if (targetTokens.has(t)) shared += 1
      const union = tokens.size + targetTokens.size - shared || 1
      const overlap = sharedFields * 0.3 + (shared / union) * 0.7
      return { m, similarity: Number(Math.min(0.9, 0.5 + overlap * 0.4).toFixed(4)) }
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit)
    .map(({ m, similarity }) => ({ ...toSummary(m), similarity }))
}

/**
 * Sort key matching the backend's surname-first ordering. Mock names read
 * "Ime Prezime", so move the first token to the back.
 */
function surnameKey(fullName: string): string {
  const [ime, ...prezime] = fullName.trim().split(/\s+/)
  return prezime.length ? `${prezime.join(' ')} ${ime}` : fullName
}

export async function mockListMentors(params: {
  zavod?: string | null
  field?: string | null
  q?: string | null
  sort?: MentorSort | null
  limit?: number
  offset?: number
}): Promise<MentorListResponse> {
  await delay(300)
  let mentors = MOCK_MENTORS
  if (params.zavod) {
    mentors = mentors.filter((m) => m.zavod_code === params.zavod)
  }
  if (params.q && params.q.trim()) {
    // Accent-insensitive, order-insensitive token match (demo parity with the
    // backend's fuzzy search; full fuzzy lives server-side).
    const norm = (s: string) =>
      s
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
    const tokens = norm(params.q).split(/\s+/).filter(Boolean)
    mentors = mentors.filter((m) => {
      const name = norm(m.full_name)
      return tokens.every((t) => name.includes(t))
    })
  }
  if (params.field) {
    const f = params.field.toLowerCase()
    mentors = mentors.filter((m) => m.scientific_fields.some((sf) => sf.toLowerCase().includes(f)))
  }
  const byName = (a: MentorSummary, b: MentorSummary) =>
    surnameKey(a.full_name).localeCompare(surnameKey(b.full_name), 'hr')
  const summaries: MentorSummary[] = mentors
    .map(toSummary)
    .sort(params.sort === 'name' ? byName : (a, b) => b.n_theses - a.n_theses || byName(a, b))
  const total = summaries.length
  const offset = params.offset ?? 0
  const limit = params.limit ?? total
  return { total, mentors: summaries.slice(offset, offset + limit) }
}

export async function mockListZavodi(): Promise<ZavodOut[]> {
  await delay(50)
  const counts = new Map<string, number>()
  for (const m of MOCK_MENTORS) {
    if (!m.zavod_code) continue
    counts.set(m.zavod_code, (counts.get(m.zavod_code) ?? 0) + 1)
  }
  return Array.from(counts, ([code, count]) => ({ code, count })).sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  )
}

export async function mockHealth(): Promise<HealthResponse> {
  await delay(50)
  return { status: 'ok (mock)' }
}

/** Thrown by the mock layer for 404-style misses; client maps real 404s too. */
export class ApiNotFound extends Error {}
