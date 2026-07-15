import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useRecommend } from '../api'
import { MentorCard } from '../components/MentorCard'
import { RecentSearches } from '../components/RecentSearches'
import { SearchForm, type SearchValues } from '../components/SearchForm'
import { ResultListSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { RECENT_MENTORS, useRecentSearches } from '../hooks/useRecentSearches'

export function SearchPage() {
  useDocumentTitle()
  const recommend = useRecommend()
  const { recent, add, remove } = useRecentSearches(RECENT_MENTORS)
  const [params, setParams] = useSearchParams()
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const initialQuery = params.get('q') ?? ''
  const initialZavod = params.get('zavod') ?? ''

  const lastSearched = useRef<string | null>(null)

  function runSearch(query: string, zavod: string) {
    lastSearched.current = query
    setSubmittedQuery(query)
    add(query)
    recommend.mutate({ query, zavod: zavod || null, top_k: 10 })
  }

  function handleSubmit(values: SearchValues) {
    const next: Record<string, string> = {}
    if (values.query) next.q = values.query
    if (values.zavod) next.zavod = values.zavod
    setParams(next, { replace: true })
    runSearch(values.query, values.zavod)
  }

  function pickRecent(query: string) {
    handleSubmit({ query, zavod: initialZavod })
  }

  // Auto-run a search when opened with ?q= (shareable/bookmarkable links).
  // StrictMode-safe: the timeout scheduled on the first (discarded) mount is
  // cleared by its cleanup, so the search fires once, on the final mount.
  useEffect(() => {
    const q = initialQuery.trim()
    if (!q || lastSearched.current === q) return
    const id = setTimeout(() => runSearch(q, initialZavod), 0)
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
        key={`${initialQuery}|${initialZavod}`}
        initialQuery={initialQuery}
        initialZavod={initialZavod}
        pending={recommend.isPending}
        onSubmit={handleSubmit}
      />

      <RecentSearches items={recent} onPick={pickRecent} onRemove={remove} />

      <section aria-live="polite">
        {recommend.isPending && (
          <>
            <span className="sr-only" role="status">
              Pretražujem radove…
            </span>
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
                : 'Pokušajte ponovno za nekoliko trenutaka.'
            }
          >
            <button
              type="button"
              onClick={() => submittedQuery && recommend.mutate({ query: submittedQuery, top_k: 10 })}
              className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Pokušaj ponovno
            </button>
          </StateMessage>
        )}

        {recommend.isSuccess && results.length === 0 && (
          <StateMessage
            title="Nema pronađenih mentora"
            description="Pokušajte preformulirati temu ili koristiti općenitije pojmove (npr. „računalni vid“, „web aplikacije“)."
          />
        )}

        {recommend.isSuccess && results.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-serif text-xl font-semibold text-ink">Predloženi mentori</h2>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                {results.length} rezultata
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
            description="Unesite opis teme iznad i pritisnite „Pronađi mentore“."
          />
        )}
      </section>
    </div>
  )
}
