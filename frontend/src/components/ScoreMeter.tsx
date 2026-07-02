import { calibrateScore, COURSE_BAND, MENTOR_BAND, type ScoreBand } from '../lib/score'

const BANDS: Record<'mentor' | 'course', ScoreBand> = {
  mentor: MENTOR_BAND,
  course: COURSE_BAND,
}

/** Refined relevance indicator. `score` is the raw API score (a mentor
 *  aggregate or a course cosine); it is calibrated onto a full 0..100% scale
 *  per `kind` so the narrow model band spreads across the meter — see
 *  lib/score. */
export function ScoreMeter({ score, kind }: { score: number; kind: 'mentor' | 'course' }) {
  const pct = Math.round(calibrateScore(score, BANDS[kind]) * 100)
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
