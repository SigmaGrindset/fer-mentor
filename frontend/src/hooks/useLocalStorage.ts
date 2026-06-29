import { useCallback, useState } from 'react'

/**
 * State persisted to `localStorage`, JSON-serialized. Reads lazily on mount and
 * tolerates unavailable/quota-exceeded storage (private mode, full disk) by
 * silently falling back to in-memory state.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (next: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw != null ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* storage unavailable or full — keep value in memory only */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, set]
}
