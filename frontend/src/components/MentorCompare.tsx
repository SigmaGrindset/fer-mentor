import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { MentorDetail, ThesisOut } from '../api'
import { useMentorsDetails } from '../api'
import { backState } from '../lib/backlink'
import { formatSimilarity, formatThesisType, pluralRadovi } from '../lib/format'
import type { SavedMentor } from '../lib/savedStore'
import { ActivityTimeline } from './ActivityTimeline'
import { Badge } from './Badge'
import { ScoreMeter } from './ScoreMeter'

/** Mirrors ActivityTimeline's sane-year clamp so "Zadnji rad" and the chart agree. */
const MIN_SANE_YEAR = 1950
const MAX_SANE_YEAR = new Date().getFullYear() + 1

/** How many current-year topics / evidence theses to show per column. */
const MAX_TOPICS = 5
const MAX_EVIDENCE = 3

function RowLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="col-span-full mt-6 border-t border-hairline pt-3 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
      {children}
    </h3>
  )
}

function Dash() {
  return (
    <span className="text-muted" aria-label="nema podataka">
      —
    </span>
  )
}

function lastSaneYear(theses: ThesisOut[]): number | null {
  let max: number | null = null
  for (const t of theses) {
    if (t.year != null && t.year >= MIN_SANE_YEAR && t.year <= MAX_SANE_YEAR) {
      if (max === null || t.year > max) max = t.year
    }
  }
  return max
}

/** Repo-thesis counts bucketed like `formatThesisType` labels them. */
function countThesisTypes(theses: ThesisOut[]) {
  const buckets = { zavrsni: 0, diplomski: 0, doktorski: 0, ostalo: 0 }
  for (const t of theses) {
    if (t.source !== 'repo') continue
    const ty = (t.thesis_type ?? '').toLowerCase()
    if (ty.includes('zavr')) buckets.zavrsni += 1
    else if (ty.includes('diplom')) buckets.diplomski += 1
    else if (ty.includes('doktor')) buckets.doktorski += 1
    else buckets.ostalo += 1
  }
  return buckets
}

/**
 * Side-by-side comparison of 2–4 saved mentors. Query-independent columns
 * (areas, activity, topics, counts) come fresh from the detail endpoint; the
 * "Radovi kao dokaz" row shows the search snapshot captured at save time.
 */
export function MentorCompare({ mentors }: { mentors: SavedMentor[] }) {
  const results = useMentorsDetails(mentors.map((m) => m.id))
  const back = backState(useLocation())

  // Per-cell state: header renders from saved fields immediately; data cells
  // show a pulse while loading and a per-column error without breaking rows.
  const cell = (i: number, content: (d: MentorDetail) => ReactNode): ReactNode => {
    const r = results[i]
    if (r.isError) return <p className="text-sm text-muted">Greška pri učitavanju.</p>
    if (r.data) return content(r.data)
    return <div className="h-12 animate-pulse rounded bg-section" />
  }

  return (
    <section aria-labelledby="usporedba-heading">
      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 id="usporedba-heading" className="font-serif text-xl font-semibold text-ink">
          Usporedba
        </h2>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted tnum">
          {mentors.length} / 4
        </p>
      </div>

      {/* Wide content scrolls in its own container; the -mx-5/px-5 bleed matches
          the layout's px-5 so on mobile the scroll area reaches the viewport
          edge while the page body never scrolls sideways. */}
      <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <div
          className="grid gap-x-6 pb-2"
          style={{ gridTemplateColumns: `repeat(${mentors.length}, minmax(14rem, 1fr))` }}
        >
          {/* Header row — from saved fields, so it never waits on the fetch. */}
          {mentors.map((m) => (
            <div key={m.id} className="min-w-0 pt-5">
              <Link
                to={`/mentor/${m.id}`}
                state={back}
                className="font-serif text-lg font-semibold tracking-tightish text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
              >
                {m.full_name}
              </Link>
              <div className="mt-1">
                <span className="text-xs text-muted">{pluralRadovi(m.n_theses)}</span>
              </div>
            </div>
          ))}

          <RowLabel>Znanstvena područja</RowLabel>
          {mentors.map((m, i) => (
            <div key={m.id} className="min-w-0 pt-3">
              {cell(i, (d) =>
                d.scientific_fields.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {d.scientific_fields.map((f) => (
                      <Badge key={f} variant="type">
                        {f}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Dash />
                ),
              )}
            </div>
          ))}

          <RowLabel>Aktivnost po godinama</RowLabel>
          {mentors.map((m, i) => (
            <div key={m.id} className="min-w-0 pt-3">
              {cell(i, (d) => {
                const last = lastSaneYear(d.theses)
                if (last === null) return <Dash />
                return (
                  <div>
                    <p className="text-sm text-ink">
                      Zadnji rad <span className="tnum">{last}.</span>
                    </p>
                    <ActivityTimeline theses={d.theses} showHeading={false} />
                  </div>
                )
              })}
            </div>
          ))}

          <RowLabel>Teme koje vodi ove godine</RowLabel>
          {mentors.map((m, i) => (
            <div key={m.id} className="min-w-0 pt-3">
              {cell(i, (d) => {
                const topics = d.theses.filter((t) => t.source === 'schedule')
                if (topics.length === 0) {
                  return <p className="text-sm text-muted">Nema tema u ovogodišnjem rasporedu.</p>
                }
                return (
                  <>
                    <ul className="space-y-1.5">
                      {topics.slice(0, MAX_TOPICS).map((t) => (
                        <li key={t.id} className="text-sm leading-snug text-ink">
                          {t.title}
                        </li>
                      ))}
                    </ul>
                    {topics.length > MAX_TOPICS && (
                      <p className="mt-1.5 text-xs text-muted">+ {topics.length - MAX_TOPICS} više</p>
                    )}
                  </>
                )
              })}
            </div>
          ))}

          <RowLabel>Mentorirani radovi</RowLabel>
          {mentors.map((m, i) => (
            <div key={m.id} className="min-w-0 pt-3">
              {cell(i, (d) => {
                const b = countThesisTypes(d.theses)
                const breakdown: [string, number][] = [
                  ['Završni', b.zavrsni],
                  ['Diplomski', b.diplomski],
                  ['Doktorski', b.doktorski],
                  ['Ostalo', b.ostalo],
                ]
                const nonZero = breakdown.filter(([, n]) => n > 0)
                return (
                  <div>
                    <p className="text-sm font-medium text-ink">{pluralRadovi(d.n_theses)}</p>
                    {nonZero.length > 0 && (
                      <ul className="mt-2 max-w-[12rem] space-y-1">
                        {nonZero.map(([label, n]) => (
                          <li key={label} className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="text-muted">{label}</span>
                            <span className="font-mono text-xs font-medium text-brand-dark tnum">
                              {n}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <RowLabel>Radovi kao dokaz</RowLabel>
          {mentors.map((m) => (
            <div key={m.id} className="min-w-0 pt-3">
              {m.evidence && m.evidence.length > 0 ? (
                <div>
                  {m.query && (
                    <p className="text-xs text-muted">
                      za upit „<span className="text-ink">{m.query}</span>“
                    </p>
                  )}
                  {m.score != null && (
                    <div className="mt-2 flex justify-start">
                      <ScoreMeter score={m.score} kind="mentor" />
                    </div>
                  )}
                  <ul className="mt-2 divide-y divide-hairline border-t border-hairline">
                    {m.evidence.slice(0, MAX_EVIDENCE).map((ev) => (
                      <li key={ev.id} className="flex items-start justify-between gap-4 py-3">
                        <div className="min-w-0">
                          {ev.url ? (
                            <a
                              href={ev.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-sm leading-snug text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
                            >
                              {ev.title}
                            </a>
                          ) : (
                            <p className="text-sm leading-snug text-ink">{ev.title}</p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide text-muted">
                            {ev.year && <span className="tnum">{ev.year}</span>}
                            {formatThesisType(ev.thesis_type) && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{formatThesisType(ev.thesis_type)}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <span
                          className="shrink-0 font-mono text-xs font-medium text-brand-dark tnum"
                          title="Sličnost rada s tvojim opisom teme"
                        >
                          {formatSimilarity(ev.similarity)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div>
                  <Dash />
                  <p className="mt-1 text-xs text-muted">Spremljeno izvan pretrage — bez dokaza.</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
