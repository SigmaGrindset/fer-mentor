/** "Nedavno" pills: click to re-run a recent query, × to forget it. */
export function RecentSearches({
  items,
  onPick,
  onRemove,
}: {
  items: string[]
  onPick: (query: string) => void
  onRemove: (query: string) => void
}) {
  if (items.length === 0) return null

  return (
    <div className="mt-6 border-t border-hairline pt-4">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        Nedavno
      </span>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {items.map((q) => (
          <span
            key={q}
            className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-section py-1 pl-3 pr-1.5 text-sm text-ink"
          >
            <button
              type="button"
              onClick={() => onPick(q)}
              className="max-w-[16rem] truncate text-left transition-colors hover:text-brand"
              title={q}
            >
              {q}
            </button>
            <button
              type="button"
              onClick={() => onRemove(q)}
              aria-label={`Ukloni „${q}“ iz nedavnih`}
              className="rounded-full p-0.5 text-muted transition-colors hover:bg-line/40 hover:text-ink"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </span>
        ))}
      </div>
    </div>
  )
}
