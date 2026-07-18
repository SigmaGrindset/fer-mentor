import { useEffect, useState } from 'react'

/**
 * How long a request has been pending, in tiers:
 *   0 — normal (nothing shown)
 *   1 — slow (≥5 s): a plain "still working" hint
 *   2 — very slow (≥15 s): likely a cold Space wake (bge-m3 load ~12 s, and the
 *       first request can exceed the client timeout), so the copy reassures the
 *       user it may take up to a minute instead of looking hung.
 * Resets as soon as `active` goes false, so a normal fast request stays at 0.
 */
export function useSlowRequest(
  active: boolean,
  slowMs = 5000,
  coldMs = 15000,
): 0 | 1 | 2 {
  const [level, setLevel] = useState<0 | 1 | 2>(0)

  useEffect(() => {
    setLevel(0)
    if (!active) return
    const t1 = setTimeout(() => setLevel(1), slowMs)
    const t2 = setTimeout(() => setLevel(2), coldMs)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [active, slowMs, coldMs])

  return level
}
