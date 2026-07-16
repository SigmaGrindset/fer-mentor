/** Numbered-page control. First + last + current±1 always shown; larger gaps
 * collapse to an ellipsis, but a gap of a single page shows that number instead
 * (never hide one page behind "…"). Renders nothing for a single page. */

function pageWindow(current: number, total: number): (number | 'gap')[] {
  const keep = [...new Set([1, total, current, current - 1, current + 1])]
    .filter((p) => p >= 1 && p <= total)
    .sort((a, b) => a - b)
  const out: (number | 'gap')[] = []
  let prev = 0
  for (const p of keep) {
    if (p - prev === 2) out.push(p - 1)
    else if (p - prev > 2) out.push('gap')
    out.push(p)
    prev = p
  }
  return out
}

const stepBtn =
  'inline-flex items-center gap-1.5 rounded border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink'

export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number
  pageCount: number
  onPageChange: (p: number) => void
}) {
  if (pageCount <= 1) return null

  return (
    <nav aria-label="Stranice radova" className="flex flex-wrap items-center justify-center gap-1.5">
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="Prethodna stranica"
        className={stepBtn}
      >
        <span aria-hidden="true">←</span>
      </button>

      {pageWindow(page, pageCount).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} aria-hidden="true" className="px-1.5 text-muted">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-label={`Stranica ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={`rounded px-3 py-2 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 ${
              item === page ? 'bg-brand text-white' : 'text-muted hover:text-ink'
            }`}
          >
            {item}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        aria-label="Sljedeća stranica"
        className={stepBtn}
      >
        <span aria-hidden="true">→</span>
      </button>
    </nav>
  )
}
