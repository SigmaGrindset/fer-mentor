import { QUERY_MAX } from '../lib/limits'

/**
 * Live character counter for the query textareas. The paired `maxLength`
 * already blocks further typing; this makes the cap visible and announces
 * hitting it, so truncated pastes don't pass silently.
 */
export function CharCounter({ length, max = QUERY_MAX }: { length: number; max?: number }) {
  const atLimit = length >= max
  return (
    <div className="mt-1.5 flex items-baseline justify-between gap-3">
      <span
        role="status"
        className={`text-xs text-red-700 ${atLimit ? 'animate-fade-in' : 'invisible'}`}
      >
        {atLimit ? `Dosegnut je najveći broj znakova (${max}).` : ''}
      </span>
      <span
        aria-hidden="true"
        className={`shrink-0 font-mono text-[0.7rem] tabular-nums ${
          atLimit ? 'font-semibold text-red-700' : 'text-muted'
        }`}
      >
        {length}/{max}
      </span>
    </div>
  )
}
