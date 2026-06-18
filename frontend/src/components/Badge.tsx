import type { ReactNode } from 'react'

type Variant = 'zavod' | 'type' | 'neutral'

const STYLES: Record<Variant, string> = {
  zavod: 'border border-brand-300 bg-brand-50 text-brand-700 uppercase tracking-[0.08em]',
  type: 'border border-hairline bg-section text-ink',
  neutral: 'border border-hairline bg-paper text-muted',
}

export function Badge({
  children,
  variant = 'neutral',
}: {
  children: ReactNode
  variant?: Variant
}) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-[0.72rem] font-medium ${STYLES[variant]}`}
    >
      {children}
    </span>
  )
}
