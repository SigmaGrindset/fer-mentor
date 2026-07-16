import { useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ThesisOut } from '../api'
import { formatThesisType, pluralRadovi } from '../lib/format'
import { Pagination } from './Pagination'
import { StateMessage } from './StateMessage'

/** How many theses per page on a mentor profile. */
export const THESIS_PAGE_SIZE = 15

/** Fold Croatian diacritics for accent-insensitive matching. NFKD strips the
 * combining marks off č/ć/š/ž; đ has no decomposition, so map it explicitly. */
const norm = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

/** Does `tok` land within `max` edits of `w` OR of any prefix of `w`? The
 * prefix part is what makes half-typed words match ("neurnsk" → "neuronskih").
 * Restricted Damerau–Levenshtein: substitutions, insertions, deletions and
 * adjacent transpositions ("nueronske") all cost 1. The last DP row holds the
 * distance from `tok` to each prefix of `w`, so its minimum answers both
 * questions in one pass; bails out early once a row exceeds the budget. */
function fuzzyPrefixMatch(tok: string, w: string, max: number): boolean {
  if (tok.length - max > w.length) return false
  let prevPrev: number[] = []
  let prev = Array.from({ length: w.length + 1 }, (_, j) => j)
  for (let i = 1; i <= tok.length; i++) {
    const cur = [i]
    let rowMin = i
    for (let j = 1; j <= w.length; j++) {
      const cost = tok[i - 1] === w[j - 1] ? 0 : 1
      let d = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && tok[i - 1] === w[j - 2] && tok[i - 2] === w[j - 1]) {
        d = Math.min(d, prevPrev[j - 2] + 1)
      }
      cur[j] = d
      if (d < rowMin) rowMin = d
    }
    if (rowMin > max) return false
    prevPrev = prev
    prev = cur
  }
  return Math.min(...prev) <= max
}

/** Typo budget per query token: none for short or numeric tokens (a "typo" in
 * 2019 would match every nearby year), 1 mistake for normal words, 2 for long
 * ones. */
const typoBudget = (tok: string) =>
  /^\d+$/.test(tok) ? 0 : tok.length >= 8 ? 2 : tok.length >= 4 ? 1 : 0

/** A query token matches a thesis if it appears as a substring, or lands within
 * its typo budget of some word (or word prefix — see fuzzyPrefixMatch). */
function tokenMatches(tok: string, hay: string, words: string[]): boolean {
  if (hay.includes(tok)) return true
  const budget = typoBudget(tok)
  if (budget === 0) return false
  return words.some((w) => fuzzyPrefixMatch(tok, w, budget))
}

/** The "Radovi" section: the full thesis list, paginated, with an optional
 * client-side filter (shown only once the list spills past one page). Sorting
 * is fixed to year-descending (as delivered by the API). */
export function ThesisList({ theses }: { theses: ThesisOut[] }) {
  const [params, setParams] = useSearchParams()
  const headingRef = useRef<HTMLHeadingElement>(null)

  const q = params.get('q') ?? ''
  // Local mirror of the input so typing isn't round-tripped through the trimmed
  // URL param (which would eat spaces mid-phrase). The URL stays the source of
  // truth for the actual filter; the component is keyed by mentor id, so a
  // fresh profile reseeds this from the (empty) URL.
  const [search, setSearch] = useState(q)

  const indexed = useMemo(
    () =>
      theses.map((t) => {
        const hay = norm([t.title, (t.keywords ?? []).join(' '), t.year ?? ''].join(' '))
        return { t, hay, words: hay.split(/[^a-z0-9]+/).filter(Boolean) }
      }),
    [theses],
  )
  const filtered = useMemo(() => {
    const tokens = norm(q).split(/\s+/).filter(Boolean)
    if (tokens.length === 0) return theses
    return indexed
      .filter((x) => tokens.every((tok) => tokenMatches(tok, x.hay, x.words)))
      .map((x) => x.t)
  }, [indexed, theses, q])

  const pageCount = Math.max(1, Math.ceil(filtered.length / THESIS_PAGE_SIZE))
  const rawPage = Math.floor(Number(params.get('page')))
  const page = Math.min(Math.max(1, Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : 1), pageCount)
  const start = (page - 1) * THESIS_PAGE_SIZE
  const visible = filtered.slice(start, start + THESIS_PAGE_SIZE)

  const canFilter = theses.length > THESIS_PAGE_SIZE

  function setQuery(value: string) {
    setSearch(value)
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const t = value.trim()
        if (t) next.set('q', t)
        else next.delete('q')
        next.delete('page') // a new filter starts from page 1
        return next
      },
      { replace: true },
    )
  }

  function goToPage(p: number) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (p <= 1) next.delete('page')
        else next.set('page', String(p))
        return next
      },
      { replace: true },
    )
    // User-initiated only (not on mount), so a deep-linked ?page= doesn't scroll.
    headingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section>
      <h2 ref={headingRef} className="font-serif text-xl font-semibold text-ink">
        Radovi <span className="font-sans text-base font-normal text-muted">({theses.length})</span>
      </h2>

      {canFilter && (
        <div className="relative mt-4">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 1 0 3.4 9.83l3.39 3.38a.75.75 0 1 0 1.06-1.06l-3.38-3.39A5.5 5.5 0 0 0 9 3.5ZM5 9a4 4 0 1 1 8 0 4 4 0 0 1-8 0Z"
              clipRule="evenodd"
            />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pretraži radove…"
            aria-label="Pretraži radove ovog mentora"
            className="w-full rounded border border-line bg-surface py-2.5 pl-9 pr-9 text-sm text-ink transition-colors placeholder:text-muted/70 hover:border-brand-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Očisti pretragu"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
      )}

      {theses.length === 0 ? (
        <div className="mt-4">
          <StateMessage title="Nema zabilježenih radova za ovog mentora." />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <StateMessage title="Nema radova koji odgovaraju pretrazi." />
        </div>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
            {visible.map((thesis) => (
              <li key={thesis.id} className="py-4">
                {thesis.url ? (
                  <a
                    href={thesis.url}
                    target="_blank"
                    rel="noreferrer"
                    className="leading-snug text-ink decoration-brand-200 underline-offset-4 hover:text-brand hover:underline"
                  >
                    {thesis.title}
                  </a>
                ) : (
                  <p className="leading-snug text-ink">{thesis.title}</p>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[0.7rem] uppercase tracking-wide text-muted">
                  {thesis.year && <span className="tnum">{thesis.year}</span>}
                  {formatThesisType(thesis.thesis_type) && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatThesisType(thesis.thesis_type)}</span>
                    </>
                  )}
                  {thesis.scientific_field && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="normal-case tracking-normal">{thesis.scientific_field}</span>
                    </>
                  )}
                </div>
                {thesis.keywords.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {thesis.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="rounded-sm border border-hairline bg-section px-2 py-0.5 text-xs text-muted"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col items-center gap-3">
            <p
              aria-live="polite"
              className="text-center font-mono text-xs uppercase tracking-[0.14em] text-muted"
            >
              Prikazano {start + 1}–{start + visible.length} od {pluralRadovi(filtered.length)}
            </p>
            <Pagination page={page} pageCount={pageCount} onPageChange={goToPage} />
          </div>
        </>
      )}
    </section>
  )
}
