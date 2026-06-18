import { useState } from 'react'
import type { CourseRecommendation } from '../api'
import { Badge } from './Badge'
import { ScoreMeter } from './ScoreMeter'

export function CourseCard({ course, rank }: { course: CourseRecommendation; rank: number }) {
  const [open, setOpen] = useState(false)
  const top = rank === 1
  const ects = course.ects != null ? `${course.ects} ECTS` : null
  const sem = course.semester != null ? `${course.semester}. semestar` : null
  const moreProfiles = Math.max(0, course.profiles.length - 3)

  return (
    <article className="rounded border border-hairline bg-surface shadow-[0_1px_0_rgba(22,32,30,0.04)] transition-colors hover:border-brand-300">
      <div className="flex gap-5 p-6">
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
              {course.url ? (
                <a
                  href={course.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-serif text-xl font-semibold tracking-tightish text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
                >
                  {course.name}
                </a>
              ) : (
                <span className="font-serif text-xl font-semibold tracking-tightish text-ink">
                  {course.name}
                </span>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted">
                {ects && <span className="tnum text-brand">{ects}</span>}
                {sem && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tnum">{sem}</span>
                  </>
                )}
              </div>
            </div>
            <ScoreMeter score={course.score} />
          </div>

          <p className="mt-4 max-w-prose text-[0.95rem] leading-relaxed text-ink/90">
            {course.explanation}
          </p>

          {course.matched_keywords && course.matched_keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {course.matched_keywords.map((kw) => (
                <span
                  key={kw}
                  className="rounded-sm bg-brand-tint px-2 py-0.5 text-xs font-medium text-brand-dark"
                >
                  {kw}
                </span>
              ))}
            </div>
          )}

          {course.outcomes_snippet && (
            <div className="mt-5 border-t border-hairline pt-3">
              <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex w-full items-center justify-between text-sm font-medium text-ink transition-colors hover:text-brand"
              >
                <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em]">
                  Ishodi učenja
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
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted">
                  {course.outcomes_snippet}
                </p>
              )}
            </div>
          )}

          {course.profiles.length > 0 && (
            <div className="mt-5">
              <h4 className="font-mono text-[0.66rem] uppercase tracking-[0.14em] text-muted">
                Izborni na smjeru
              </h4>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {course.profiles.slice(0, 3).map((p) => (
                  <Badge key={p} variant="zavod">
                    {p}
                  </Badge>
                ))}
                {moreProfiles > 0 && (
                  <span className="text-xs text-muted">+{moreProfiles} drugih</span>
                )}
              </div>
            </div>
          )}

          {course.url && (
            <div className="mt-5">
              <a
                href={course.url}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand decoration-brand-200 underline-offset-4 hover:text-brand-dark hover:underline"
              >
                Stranica predmeta →
              </a>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
