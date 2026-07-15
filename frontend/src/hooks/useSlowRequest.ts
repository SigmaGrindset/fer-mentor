import { useEffect, useState } from 'react'

/**
 * True once `active` has stayed true for `delayMs` uninterrupted. Lets a
 * pending view explain an unusually long wait — the free Hugging Face Space
 * costs ~12s to wake when the keep-warm cron hasn't caught it. Resets as soon
 * as `active` goes false, so a normal fast request never trips it.
 */
export function useSlowRequest(active: boolean, delayMs = 5000): boolean {
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    setSlow(false)
    if (!active) return
    const id = setTimeout(() => setSlow(true), delayMs)
    return () => clearTimeout(id)
  }, [active, delayMs])

  return slow
}
