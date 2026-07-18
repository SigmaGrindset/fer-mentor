import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookmarkButton } from '../components/BookmarkButton'
import { MentorCompare } from '../components/MentorCompare'
import { StateMessage } from '../components/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSaved } from '../hooks/useSaved'
import { backState } from '../lib/backlink'
import { pluralRadovi } from '../lib/format'

/** The shortlist: bookmarked mentors and courses, newest first. */
export function SavedPage() {
  useDocumentTitle('Spremljeni')
  const { mentors, courses, toggleMentor, toggleCourse } = useSaved()
  const back = backState(useLocation())
  const empty = mentors.length === 0 && courses.length === 0

  const [compareIds, setCompareIds] = useState<number[]>([])
  const canCompare = mentors.length >= 2
  // Derived from the live list, so a mentor unsaved here or in another tab
  // drops out of the comparison automatically.
  const selected = mentors.filter((m) => compareIds.includes(m.id))

  function toggleCompare(id: number) {
    setCompareIds((ids) => {
      // Drop ids of since-unsaved mentors so they can't hold a slot.
      const live = ids.filter((x) => mentors.some((m) => m.id === x))
      if (live.includes(id)) return live.filter((x) => x !== id)
      return live.length >= 4 ? live : [...live, id]
    })
  }

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">Tvoj izbor</p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tightish text-ink sm:text-5xl">
          Spremljeni.
        </h1>
        <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-muted">
          Tvoj popis mentora i izbornih predmeta za usporedbu — ostaje spremljen
          u ovom pregledniku dok ga ne izmijeniš.
        </p>
      </section>

      {empty && (
        <StateMessage
          title="Još nema spremljenih"
          description="Klikni oznaku na kartici mentora ili predmeta da je spremiš ovdje."
        >
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <Link
              to="/"
              className="text-sm font-medium text-brand decoration-brand-200 underline-offset-4 hover:text-brand-dark hover:underline"
            >
              Pretraži mentore →
            </Link>
            <Link
              to="/izborni"
              className="text-sm font-medium text-brand decoration-brand-200 underline-offset-4 hover:text-brand-dark hover:underline"
            >
              Pronađi izborne →
            </Link>
          </div>
        </StateMessage>
      )}

      {mentors.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-xl font-semibold text-ink">Mentori</h2>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted tnum">
              {mentors.length}
            </p>
          </div>
          {canCompare && (
            <p className="mt-3 text-sm text-muted">Označi 2–4 mentora za usporedbu.</p>
          )}
          <ul className="divide-y divide-hairline">
            {mentors.map((m) => {
              const checked = compareIds.includes(m.id)
              const full = !checked && selected.length >= 4
              return (
                <li key={m.id} className="flex items-center justify-between gap-4 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    {canCompare && (
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0 accent-brand"
                        checked={checked}
                        disabled={full}
                        onChange={() => toggleCompare(m.id)}
                        aria-label={`Usporedi: ${m.full_name}`}
                        title={full ? 'Najviše četiri mentora' : undefined}
                      />
                    )}
                    <div className="min-w-0">
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
                  </div>
                  <BookmarkButton
                    saved
                    onToggle={() => toggleMentor(m)}
                    itemLabel={m.full_name}
                  />
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {selected.length >= 2 && <MentorCompare mentors={selected} />}

      {courses.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between border-b border-hairline pb-3">
            <h2 className="font-serif text-xl font-semibold text-ink">Izborni predmeti</h2>
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted tnum">
              {courses.length}
            </p>
          </div>
          <ul className="divide-y divide-hairline">
            {courses.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-4">
                <div className="min-w-0">
                  {c.url ? (
                    <a
                      href={c.url}
                      target="_blank"
                      rel="noreferrer"
                      className="font-serif text-lg font-semibold tracking-tightish text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
                    >
                      {c.name}
                    </a>
                  ) : (
                    <span className="font-serif text-lg font-semibold tracking-tightish text-ink">
                      {c.name}
                    </span>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.72rem] uppercase tracking-[0.1em] text-muted">
                    <span>{c.code}</span>
                    {c.ects != null && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tnum text-brand">{c.ects} ECTS</span>
                      </>
                    )}
                  </div>
                </div>
                <BookmarkButton saved onToggle={() => toggleCourse(c)} itemLabel={c.name} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
