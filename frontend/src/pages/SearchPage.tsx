import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRecommend } from '../api'
import { MentorCard } from '../components/MentorCard'
import { RecentSearches } from '../components/RecentSearches'
import { SearchForm, type SearchValues } from '../components/SearchForm'
import { ResultListSkeleton } from '../components/Skeleton'
import { LoadingStatus, StateMessage } from '../components/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { RECENT_MENTORS, useRecentSearches } from '../hooks/useRecentSearches'
import { useSlowRequest } from '../hooks/useSlowRequest'
import { pluralRezultati } from '../lib/format'

export function SearchPage() {
  useDocumentTitle()
  const recommend = useRecommend()
  const slow = useSlowRequest(recommend.isPending)
  const { recent, add, remove } = useRecentSearches(RECENT_MENTORS)
  const [params, setParams] = useSearchParams()
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const initialQuery = params.get('q') ?? ''
  const initialZavod = params.get('zavod') ?? ''
  // Sanitize: a hand-edited ?tip= falls back to "all" instead of a 422.
  const rawTip = params.get('tip') ?? ''
  const initialThesisType = rawTip === 'zavrsni' || rawTip === 'diplomski' ? rawTip : ''

  const lastSearched = useRef<string | null>(null)
  const resultsRef = useRef<HTMLElement>(null)

  // On mobile the form fills the viewport, so freshly submitted searches
  // render their skeletons/results below the fold. Once loading starts,
  // bring the results section into view — but only when it's actually
  // out of sight, so desktop (where it's already visible) never jumps.
  useEffect(() => {
    if (!recommend.isPending) return
    const el = resultsRef.current
    if (!el) return
    if (el.getBoundingClientRect().top > window.innerHeight * 0.75) {
      el.scrollIntoView({
        // 'instant' (not 'auto') because the global CSS scroll-behavior is
        // smooth; 'auto' would defer to it and animate anyway.
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
        block: 'start',
      })
    }
  }, [recommend.isPending])

  function runSearch(query: string, zavod: string, thesisType: string) {
    lastSearched.current = query
    setSubmittedQuery(query)
    add(query)
    recommend.mutate({
      query,
      zavod: zavod || null,
      thesis_type:
        thesisType === 'zavrsni' || thesisType === 'diplomski' ? thesisType : null,
      top_k: 10,
    })
  }

  function handleSubmit(values: SearchValues) {
    const next: Record<string, string> = {}
    if (values.query) next.q = values.query
    if (values.zavod) next.zavod = values.zavod
    if (values.thesisType) next.tip = values.thesisType
    setParams(next, { replace: true })
    runSearch(values.query, values.zavod, values.thesisType)
  }

  function pickRecent(query: string) {
    handleSubmit({ query, zavod: initialZavod, thesisType: initialThesisType })
  }

  // Auto-run a search when opened with ?q= (shareable/bookmarkable links).
  // StrictMode-safe: the timeout scheduled on the first (discarded) mount is
  // cleared by its cleanup, so the search fires once, on the final mount.
  useEffect(() => {
    const q = initialQuery.trim()
    if (!q || lastSearched.current === q) return
    const id = setTimeout(() => runSearch(q, initialZavod, initialThesisType), 0)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery])

  const results = recommend.data?.results ?? []

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
          Preporuka mentora
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tightish text-ink sm:text-5xl">
          Pronađi mentora za svoj rad.
        </h1>
        <p className="mt-5 max-w-prose text-[1.05rem] leading-relaxed text-muted">
          Opiši temu svojim riječima — FERmentor uspoređuje tvoj opis sa svim
          završnim i diplomskim radovima na FER-u i predlaže mentore čiji se rad
          najbolje podudara, uz konkretne radove kao dokaz.
        </p>
      </section>

      <SearchForm
        key={`${initialQuery}|${initialZavod}|${initialThesisType}`}
        initialQuery={initialQuery}
        initialZavod={initialZavod}
        initialThesisType={initialThesisType}
        pending={recommend.isPending}
        onSubmit={handleSubmit}
      />

      <RecentSearches items={recent} onPick={pickRecent} onRemove={remove} />

      <section ref={resultsRef} aria-live="polite" className="scroll-mt-6">
        {recommend.isPending && (
          <>
            <LoadingStatus label="Pretražujem radove…" slow={slow} />
            <ResultListSkeleton count={4} />
          </>
        )}

        {recommend.isError && (
          <StateMessage
            tone="error"
            title="Došlo je do pogreške pri pretraživanju"
            description={
              recommend.error instanceof Error
                ? recommend.error.message
                : 'Pokušaj ponovno za nekoliko trenutaka.'
            }
          >
            <button
              type="button"
              onClick={() =>
                submittedQuery &&
                runSearch(submittedQuery, initialZavod, initialThesisType)
              }
              className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Pokušaj ponovno
            </button>
          </StateMessage>
        )}

        {recommend.isSuccess && results.length === 0 && (
          <StateMessage
            title="Nema pronađenih mentora"
            description="Pokušaj preformulirati temu ili koristiti općenitije pojmove (npr. „računalni vid“, „web aplikacije“)."
          />
        )}

        {recommend.isSuccess && results.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-serif text-xl font-semibold text-ink">Predloženi mentori</h2>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                {pluralRezultati(results.length)}
              </p>
            </div>
            <p className="mt-3 text-sm text-muted">
              za temu „<span className="text-ink">{submittedQuery}</span>“
            </p>
            <div className="mt-6 space-y-5">
              {results.map((mentor, i) => (
                <MentorCard key={mentor.mentor_id} mentor={mentor} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {recommend.isIdle && (
          <StateMessage
            title="Spremni za pretragu"
            description="Unesi opis teme iznad i pritisni „Pronađi mentore“."
          />
        )}
      </section>
    </div>
  )
}
