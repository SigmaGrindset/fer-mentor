import type { ReactNode } from 'react'

/** Generic empty/error/info panel. */
export function StateMessage({
  title,
  description,
  tone = 'info',
  children,
}: {
  title: string
  description?: string
  tone?: 'info' | 'error'
  children?: ReactNode
}) {
  const ring =
    tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : 'border-hairline bg-section text-ink'
  return (
    <div className={`rounded border px-6 py-10 text-center ${ring}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm opacity-80">{description}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  )
}

const WAKING = 'Server se budi, još malo…'
const COLD = 'Prvi upit nakon buđenja zna potrajati do minute — samo trenutak…'

/**
 * Live status for a pending request. `slow` is the tier from useSlowRequest
 * (0 normal, 1 slow, 2 very-slow/cold). Screen-reader-only while normal; once
 * it runs long the same region surfaces a visible line — escalating to a
 * cold-start reassurance at tier 2 — so a slow wake reads as an explained wait
 * rather than a hang. The element stays mounted across the swap so screen
 * readers announce the change in text.
 */
export function LoadingStatus({ label, slow }: { label: string; slow: boolean | 0 | 1 | 2 }) {
  const level = Number(slow)
  const text = level >= 2 ? COLD : level >= 1 ? WAKING : label
  return (
    <p role="status" className={level >= 1 ? 'mb-4 animate-fade-in text-sm text-muted' : 'sr-only'}>
      {text}
    </p>
  )
}
