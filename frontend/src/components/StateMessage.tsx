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
