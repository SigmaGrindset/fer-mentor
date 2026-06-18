/** Refined relevance indicator for a 0..1 score. */
export function ScoreMeter({ score }: { score: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, score)) * 100)
  const label = pct >= 80 ? 'Vrlo visoko' : pct >= 60 ? 'Visoko' : pct >= 40 ? 'Srednje' : 'Nisko'

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5" title={`Podudaranje: ${pct}%`}>
      <span className="font-mono text-2xl font-medium leading-none tracking-tight text-ink tnum">
        {pct}
        <span className="text-base text-muted">%</span>
      </span>
      <div className="h-1 w-24 overflow-hidden rounded-full bg-section">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[0.65rem] uppercase tracking-[0.12em] text-muted">
        {label} podudaranje
      </span>
    </div>
  )
}
