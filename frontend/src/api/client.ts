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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  })
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = (await res.json()) as { detail?: string }
      if (body?.detail) detail = body.detail
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new ApiError(detail || `HTTP ${res.status}`, res.status)
  }
  return (await res.json()) as T
}

export async function recommend(req: RecommendRequest): Promise<RecommendResponse> {
  if (!USING_REAL_API) return mockRecommend(req)
  return request<RecommendResponse>('/api/recommend', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function getMentor(id: number): Promise<MentorDetail> {
  if (!USING_REAL_API) {
    try {
      return await mockGetMentor(id)
    } catch (e) {
      if (e instanceof ApiNotFound) throw new ApiError(e.message, 404)
      throw e
    }
  }
  return request<MentorDetail>(`/api/mentors/${id}`)
}

export async function getSimilarMentors(id: number, limit = 6): Promise<SimilarMentor[]> {
  if (!USING_REAL_API) {
    try {
      return await mockGetSimilarMentors(id, limit)
    } catch (e) {
      if (e instanceof ApiNotFound) throw new ApiError(e.message, 404)
      throw e
    }
  }
  return request<SimilarMentor[]>(`/api/mentors/${id}/similar?limit=${limit}`)
}

export async function listMentors(params: {
  zavod?: string | null
  field?: string | null
  q?: string | null
  sort?: MentorSort | null
  limit?: number
  offset?: number
} = {}): Promise<MentorListResponse> {
  if (!USING_REAL_API) return mockListMentors(params)
  const qs = new URLSearchParams()
  if (params.zavod) qs.set('zavod', params.zavod)
  if (params.field) qs.set('field', params.field)
  if (params.q) qs.set('q', params.q)
  if (params.sort) qs.set('sort', params.sort)
  if (params.limit != null) qs.set('limit', String(params.limit))
  if (params.offset != null) qs.set('offset', String(params.offset))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  return request<MentorListResponse>(`/api/mentors${suffix}`)
}

export async function listZavodi(): Promise<ZavodOut[]> {
  if (!USING_REAL_API) return mockListZavodi()
  return request<ZavodOut[]>('/api/zavodi')
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
