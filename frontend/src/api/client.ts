/**
 * API client. Single switch point between the real backend and the mock layer.
 *
 * - If `VITE_API_BASE_URL` is set (e.g. http://localhost:8000), all calls hit
 *   the real FastAPI backend at that origin under `/api/...`.
 * - If it is unset/empty, calls are served from the in-memory mock (src/api/mock.ts).
 *
 * Pointing at the real backend is a one-liner: set VITE_API_BASE_URL in .env.
 */
import {
  ApiNotFound,
  mockGetMentor,
  mockGetSimilarMentors,
  mockHealth,
  mockListMentors,
  mockListZavodi,
  mockRecommend,
} from './mock'
import { mockGetProgrammes, mockRecommendCourses } from './mockCourses'
import type {
  CourseRecommendRequest,
  CourseRecommendResponse,
  HealthResponse,
  MentorDetail,
  MentorListResponse,
  MentorSort,
  MetaResponse,
  ProgrammeCatalog,
  RecommendRequest,
  RecommendResponse,
  SimilarMentor,
  ZavodOut,
} from './types'

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')

/** Whether the app is talking to a real backend (vs. the mock layer). */
export const USING_REAL_API = BASE_URL.length > 0

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Request timeout. Generous because a cold HF Space can take ~20 s to wake. */
const TIMEOUT_MS = 30_000

/**
 * The first request after the Space restarts loads bge-m3 (~12 s) and can take
 * longer than TIMEOUT_MS, and a burst can shed a request with 503. Both clear on
 * a second try against the now-warm/less-busy server, so retry those once. Never
 * retry a caller-driven abort, a 429 (rate limit) or a 4xx (bad input).
 */
async function attempt<T>(path: string, init: RequestInit | undefined): Promise<T> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      ...init,
      signal: init?.signal ? AbortSignal.any([timeout, init.signal]) : timeout,
    })
  } catch (e) {
    // Caller-driven aborts (e.g. component unmount) must propagate untouched.
    if (init?.signal?.aborted) throw e
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ApiError(
        'Poslužitelj se ne javlja — vjerojatno se tek budi. Pokušaj ponovno za minutu.',
        0,
      )
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiError('Nema internetske veze. Provjeri mrežu i pokušaj ponovno.', 0)
    }
    throw new ApiError(
      'Ne mogu se spojiti na poslužitelj. Pokušaj ponovno za nekoliko trenutaka.',
      0,
    )
  }
  if (!res.ok) {
    let detail = ''
    try {
      const body = (await res.json()) as { detail?: unknown }
      // FastAPI 422s carry an array of validation objects — only trust strings.
      if (typeof body?.detail === 'string') detail = body.detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    if (res.status === 429) detail = 'Previše upita — pričekaj minutu.'
    else if (res.status === 422 && !detail)
      detail = 'Upit nije prošao provjeru — opis smije imati najviše 500 znakova.'
    else if (res.status === 503 && !detail)
      detail = 'Trenutačno je gužva na poslužitelju. Pokušaj ponovno za koji trenutak.'
    else if (res.status >= 500)
      detail = 'Poslužitelj je javio pogrešku. Pokušaj ponovno za nekoliko trenutaka.'
    throw new ApiError(detail || res.statusText || `HTTP ${res.status}`, res.status)
  }
  return (await res.json()) as T
}

/** A cold-start timeout (status 0) or a load-shed 503 is worth one retry. */
function isRetryable(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 0 || e.status === 503)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  try {
    return await attempt<T>(path, init)
  } catch (e) {
    if (init?.signal?.aborted || !isRetryable(e)) throw e
    // Brief pause so a waking/busy Space has a moment before the second try.
    await new Promise((r) => setTimeout(r, 1500))
    if (init?.signal?.aborted) throw e
    return attempt<T>(path, init)
  }
}

export async function recommend(req: RecommendRequest): Promise<RecommendResponse> {
  if (!USING_REAL_API) return mockRecommend(req)
  return request<RecommendResponse>('/api/recommend', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function getMentor(id: number, signal?: AbortSignal): Promise<MentorDetail> {
  if (!USING_REAL_API) {
    try {
      return await mockGetMentor(id)
    } catch (e) {
      if (e instanceof ApiNotFound) throw new ApiError(e.message, 404)
      throw e
    }
  }
  return request<MentorDetail>(`/api/mentors/${id}`, { signal })
}

export async function getSimilarMentors(
  id: number,
  limit = 6,
  signal?: AbortSignal,
): Promise<SimilarMentor[]> {
  if (!USING_REAL_API) {
    try {
      return await mockGetSimilarMentors(id, limit)
    } catch (e) {
      if (e instanceof ApiNotFound) throw new ApiError(e.message, 404)
      throw e
    }
  }
  return request<SimilarMentor[]>(`/api/mentors/${id}/similar?limit=${limit}`, { signal })
}

export async function listMentors(params: {
  zavod?: string | null
  field?: string | null
  q?: string | null
  sort?: MentorSort | null
  limit?: number
  offset?: number
} = {}, signal?: AbortSignal): Promise<MentorListResponse> {
  if (!USING_REAL_API) return mockListMentors(params)
  const qs = new URLSearchParams()
  if (params.zavod) qs.set('zavod', params.zavod)
  if (params.field) qs.set('field', params.field)
  if (params.q) qs.set('q', params.q)
  if (params.sort) qs.set('sort', params.sort)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return request<MentorListResponse>(`/api/mentors${suffix}`, { signal })
}

export async function listZavodi(): Promise<ZavodOut[]> {
  if (!USING_REAL_API) return mockListZavodi()
  return request<ZavodOut[]>('/api/zavodi')
}

/** Last successful ingest per source. Only meaningful against a real backend. */
export async function getMeta(): Promise<MetaResponse> {
  return request<MetaResponse>('/api/meta')
}

export async function health(): Promise<HealthResponse> {
  if (!USING_REAL_API) return mockHealth()
  return request<HealthResponse>('/api/health')
}

/* ---- Feature #2: elective courses ---- */

export async function getProgrammes(): Promise<ProgrammeCatalog> {
  if (!USING_REAL_API) return mockGetProgrammes()
  return request<ProgrammeCatalog>('/api/programmes')
}

export async function recommendCourses(
  req: CourseRecommendRequest,
): Promise<CourseRecommendResponse> {
  if (!USING_REAL_API) return mockRecommendCourses(req)
  return request<CourseRecommendResponse>('/api/courses/recommend', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}
