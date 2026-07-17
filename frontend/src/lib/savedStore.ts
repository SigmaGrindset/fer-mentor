/**
 * Shortlist ("Spremljeni") store: bookmarked mentors and courses, persisted to
 * `localStorage`. A module-level cache + subscriber set (for
 * `useSyncExternalStore`) keeps every bookmark button, the nav counter and the
 * saved page in sync within a tab; the `storage` event syncs across tabs.
 */

import { USING_REAL_API } from '../api'
import type { EvidenceThesis } from '../api'

/**
 * Snapshot of a saved mentor — `MentorSummary` fields plus the save time.
 * The search-snapshot fields are present only when the mentor was saved from
 * search results; their absence means "saved outside search" (profile page,
 * or an entry written before these fields existed).
 */
export interface SavedMentor {
  id: number
  full_name: string
  zavod_code?: string | null
  n_theses: number
  /** epoch ms; lists render newest-first */
  savedAt: number
  /** the search query that produced the recommendation */
  query?: string
  /** aggregated relevance score at save time */
  score?: number
  /** similarity-scored theses that justified the recommendation */
  evidence?: EvidenceThesis[]
  matched_keywords?: string[]
}

/**
 * Snapshot of a saved course. Only query-independent fields: score, semester,
 * explanation etc. depend on the search that produced the recommendation.
 */
export interface SavedCourse {
  id: number
  code: string
  name: string
  ects?: number | null
  url?: string | null
  savedAt: number
}

export interface SavedState {
  mentors: SavedMentor[]
  courses: SavedCourse[]
}

// Mock and real backends have disjoint id spaces, so mock-era saves must not
// leak into (and 404 against) the real API.
const SUFFIX = USING_REAL_API ? '' : '.mock'
export const SAVED_MENTORS_KEY = `fermentor.saved.mentors${SUFFIX}`
export const SAVED_COURSES_KEY = `fermentor.saved.courses${SUFFIX}`

function readList<T extends { id: number; savedAt: number }>(
  key: string,
  nameField: 'full_name' | 'name',
): T[] {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // History state written by older/other code isn't necessarily ours — keep
    // only entries that can actually render.
    return parsed.filter(
      (e): e is T =>
        typeof e === 'object' &&
        e != null &&
        typeof (e as T).id === 'number' &&
        typeof (e as Record<string, unknown>)[nameField] === 'string',
    )
  } catch {
    return []
  }
}

function readState(): SavedState {
  return {
    mentors: readList<SavedMentor>(SAVED_MENTORS_KEY, 'full_name'),
    courses: readList<SavedCourse>(SAVED_COURSES_KEY, 'name'),
  }
}

let cache: SavedState = readState()
const listeners = new Set<() => void>()

function write(key: string, list: SavedMentor[] | SavedCourse[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* storage unavailable or full — keep the state in memory only */
  }
}

function notify() {
  for (const l of listeners) l()
}

/** Referentially stable between mutations, as `useSyncExternalStore` requires. */
export function getSavedSnapshot(): SavedState {
  return cache
}

export function subscribeSaved(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

// Another tab toggled a bookmark (or cleared storage) — re-read and re-render.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null || e.key === SAVED_MENTORS_KEY || e.key === SAVED_COURSES_KEY) {
      cache = readState()
      notify()
    }
  })
}

/** Toggle by id: saving an already-saved item removes it (dedupe for free). */
function toggle<T extends { id: number; savedAt: number }>(
  list: T[],
  item: Omit<T, 'savedAt'>,
): T[] {
  if (list.some((e) => e.id === item.id)) return list.filter((e) => e.id !== item.id)
  return [{ ...item, savedAt: Date.now() } as T, ...list]
}

export function toggleSavedMentor(mentor: Omit<SavedMentor, 'savedAt'>) {
  cache = { ...cache, mentors: toggle(cache.mentors, mentor) }
  write(SAVED_MENTORS_KEY, cache.mentors)
  notify()
}

export function toggleSavedCourse(course: Omit<SavedCourse, 'savedAt'>) {
  cache = { ...cache, courses: toggle(cache.courses, course) }
  write(SAVED_COURSES_KEY, cache.courses)
  notify()
}
