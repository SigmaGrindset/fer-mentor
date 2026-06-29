import { useCallback } from 'react'
import { useLocalStorage } from './useLocalStorage'

/** localStorage keys, one list per feature. */
export const RECENT_MENTORS = 'fermentor.recent.mentors'
export const RECENT_ELECTIVES = 'fermentor.recent.electives'

const MAX_RECENT = 5

/**
 * A small most-recent-first list of distinct search queries, persisted under
 * `key`. `add` de-duplicates case-insensitively and caps the list at 5.
 */
export function useRecentSearches(key: string) {
  const [recent, setRecent] = useLocalStorage<string[]>(key, [])

  const add = useCallback(
    (query: string) => {
      const q = query.trim()
      if (!q) return
      setRecent((prev) => {
        const deduped = prev.filter((x) => x.toLowerCase() !== q.toLowerCase())
        return [q, ...deduped].slice(0, MAX_RECENT)
      })
    },
    [setRecent],
  )

  const remove = useCallback(
    (query: string) => {
      setRecent((prev) => prev.filter((x) => x !== query))
    },
    [setRecent],
  )

  return { recent, add, remove }
}
