import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { MentorRecommendation } from '../api'
import { useSaved } from '../hooks/useSaved'
import { backState } from '../lib/backlink'
import { formatSimilarity, formatThesisType, pluralRadovi } from '../lib/format'
import { BookmarkButton } from './BookmarkButton'
import { ScoreMeter } from './ScoreMeter'

export function MentorCard({
  mentor,
  rank,
  query,
}: {
  mentor: MentorRecommendation
  rank: number
  /** the submitted search query; saved alongside the bookmark so the
   *  comparison view can show the evidence that led to saving */
  query?: string
}) {
  const [open, setOpen] = useState(false)
  const back = backState(useLocation())
  const { isMentorSaved, toggleMentor } = useSaved()
  const top = rank === 1

  return (
    <article className="rounded border border-hairline bg-surface shadow-[0_1px_0_rgba(22,32,30,0.04)] transition-colors hover:border-brand-300">
      <div className="flex gap-5 p-5 sm:p-6">
        {/* Editorial rank numeral */}
        <div
          className={`hidden shrink-0 select-none pt-0.5 font-serif text-3xl font-semibold leading-none tnum sm:block ${
            top ? 'text-ochre' : 'text-line'
          }`}
        >
          {String(rank).padStart(2, '0')}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Link
                to={`/mentor/${mentor.mentor_id}`}
                state={back}
                className="font-serif text-xl font-semibold tracking-tightish text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
              >
                {mentor.full_name}
              </Link>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                {mentor.zavod_code && (
                  <span className="font-mono text-[0.72rem] uppercase tracking-[0.1em] text-brand">
                    {mentor.zavod_code}
                  </span>
                )}
                <span className="text-xs text-muted">{pluralRadovi(mentor.n_theses)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-start gap-1.5">
              <BookmarkButton
                saved={isMentorSaved(mentor.mentor_id)}
                onToggle={() =>
                  toggleMentor({
                    id: mentor.mentor_id,
                    full_name: mentor.full_name,
                    zavod_code: mentor.zavod_code,
                    n_theses: mentor.n_theses,
                    ...(query
                      ? {
                          query,
                          score: mentor.score,
                          evidence: mentor.evidence,
                          matched_keywords: mentor.matched_keywords,
                        }
                      : {}),
                  })
                }
                itemLabel={mentor.full_name}
              />
              <ScoreMeter score={mentor.score} kind="mentor" />
            </div>
          </div>

          <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-ink/90">
            {mentor.explanation}
          </p>

          {mentor.matched_keywords && mentor.matched_keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {mentor.matched_keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-sm bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand-dark"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {mentor.current_topics.length > 0 && (
            <div className="mt-5 border-l-2 border-brand-300 bg-brand-tint/40 px-4 py-3">
              <h4 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-brand-dark">
                Teme koje vodi ove godine
              </h4>
              <ul className="mt-2 space-y-1.5">
                {mentor.current_topics.map((topic) => (
                  <li key={topic} className="text-sm leading-snug text-ink">
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mentor.evidence.length > 0 && (
            <div className="mt-5 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between text-sm font-medium text-ink transition-colors hover:text-brand"
              >
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em]">
                  Radovi kao dokaz · {mentor.evidence.length}
                </span>
                <svg
                  className={`h-4 w-4 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>

              {open && (
                <ul className="mt-3 divide-y divide-hairline border-t border-hairline">
                  {mentor.evidence.map((ev) => (
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
              )}
            </div>
          )}

          <div className="mt-5">
            <Link
              to={`/mentor/${mentor.mentor_id}`}
              state={back}
              className="text-sm font-medium text-brand decoration-brand-200 underline-offset-4 hover:text-brand-dark hover:underline"
            >
              Pogledaj profil mentora →
            </Link>
          </div>
        </div>
      </div>
    </article>
  )
}
