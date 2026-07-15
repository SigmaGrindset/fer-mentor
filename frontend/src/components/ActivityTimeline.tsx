import { pluralRadovi } from '../lib/format'

/** Discard obvious data glitches (year 202, 3021…) so one bad row can't
 *  stretch the axis across centuries. */
const MIN_SANE_YEAR = 1950
const MAX_SANE_YEAR = new Date().getFullYear() + 1

/** Width budget per year slot (bar + 2px gap); the row never grows wider
 *  than the data needs, so short spans keep bars at a natural width. */
const SLOT_PX = 20

/**
 * Tiny bar-per-year chart of thesis counts — answers "is this mentor still
 * active?" at a glance. Contiguous axis from the first to the last known
 * year; empty years stay empty so gaps in activity are visible. Values live
 * in per-bar hover tooltips (the thesis list below is the full data view).
 */
export function ActivityTimeline({ theses }: { theses: { year?: number | null }[] }) {
  const counts = new Map<number, number>()
  for (const t of theses) {
    if (t.year != null && t.year >= MIN_SANE_YEAR && t.year <= MAX_SANE_YEAR) {
      counts.set(t.year, (counts.get(t.year) ?? 0) + 1)
    }
  }
  // A single year has nothing to chart — the thesis list already shows it.
  if (counts.size < 2) return null

  const years = [...counts.keys()]
  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)
  const maxCount = Math.max(...counts.values())

  const slots: { year: number; count: number }[] = []
  for (let y = minYear; y <= maxYear; y++) {
    slots.push({ year: y, count: counts.get(y) ?? 0 })
  }
  const peak = slots.reduce((a, b) => (b.count > a.count ? b : a))

  return (
    <div className="mt-5">
      <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        Aktivnost po godinama
      </h2>
      <div
        role="img"
        aria-label={`Radovi po godinama, od ${minYear}. do ${maxYear}. Najviše ${peak.year}.: ${pluralRadovi(peak.count)}.`}
        className="mt-2 max-w-md"
        style={{ width: `clamp(6rem, ${slots.length * SLOT_PX}px, 100%)` }}
      >
        <div aria-hidden="true" className="flex h-14 items-end gap-[2px] border-b border-line">
          {slots.map(({ year, count }, i) => (
            <div
              key={year}
              className="group relative flex h-full flex-1 items-end justify-center"
            >
              {/* Anchor edge tooltips to the slot instead of centering, so they
                  never clip at the viewport edge. */}
              <div
                className={`pointer-events-none absolute bottom-full z-10 mb-1.5 hidden whitespace-nowrap rounded bg-ink px-2 py-1 font-mono text-[0.7rem] text-paper group-hover:block ${
                  i < 2 ? 'left-0' : i > slots.length - 3 ? 'right-0' : 'left-1/2 -translate-x-1/2'
                }`}
              >
                {year}. · {pluralRadovi(count)}
              </div>
              {count > 0 && (
                <div
                  className="w-full max-w-[18px] rounded-t bg-brand transition-colors group-hover:bg-brand-600 dark:group-hover:bg-brand-300"
                  style={{ height: `max(${(count / maxCount) * 100}%, 3px)` }}
                />
              )}
            </div>
          ))}
        </div>
        <div aria-hidden="true" className="mt-1 flex justify-between font-mono text-[0.65rem] text-muted tnum">
          <span>{minYear}</span>
          <span>{maxYear}</span>
        </div>
      </div>
    </div>
  )
}
