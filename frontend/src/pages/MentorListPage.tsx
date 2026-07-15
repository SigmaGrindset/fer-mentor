import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { useMentorListInfinite } from '../api'
import { Badge } from '../components/Badge'
import { MentorListSkeleton } from '../components/Skeleton'
import { LoadingStatus, StateMessage } from '../components/StateMessage'
import { ZavodSelect } from '../components/ZavodSelect'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSlowRequest } from '../hooks/useSlowRequest'
import { backState } from '../lib/backlink'
import { pluralMentori, pluralRadovi } from '../lib/format'

/** '' is the server default: most theses first (best match while searching). */
const SORT_OPTIONS = [
  { value: '', label: 'Po broju radova' },
  { value: 'name', label: 'Abecedno' },
] as const

export function MentorListPage() {
  useDocumentTitle('Mentori')
  // Filters live in the URL so results are shareable/bookmarkable.
  const [params, setParams] = useSearchParams()
  const back = backState(useLocation())
  const zavod = params.get('zavod') ?? ''
  const urlQ = params.get('q') ?? ''
  // Anything unrecognized falls back to the default ordering.
  const sort = params.get('sort') === 'name' ? 'name' : null
  // Local mirror for the text input; debounced into the URL below.
  const [search, setSearch] = useState(urlQ)

  function updateParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }

  // Debounce the typed query into the URL so we don't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(() => updateParam('q', search.trim()), 250)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const {
    data,
    isPending,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useMentorListInfinite({ zavod: zavod || null, q: urlQ || null, sort })
  const slow = useSlowRequest(isPending)

  const mentors = useMemo(() => data?.pages.flatMap((p) => p.mentors) ?? [], [data])
  const total = data?.pages[0]?.total ?? 0
  const filtered = Boolean(zavod || urlQ)

  return (
    <div className="space-y-8">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
          Mentori
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tightish text-ink sm:text-5xl">
          Pregled mentora.
        </h1>
        <p className="mt-4 max-w-prose text-[1.05rem] leading-relaxed text-muted">
          Pretraži sve mentore na FER-u po imenu ili filtriraj po zavodu. Klikni
          mentora za njegove radove i područja.
        </p>
      </section>

      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pretraži mentora po imenu…"
            aria-label="Pretraži mentora po imenu"
            className="w-full rounded border border-line bg-surface py-2.5 pl-9 pr-9 text-sm text-ink transition-colors placeholder:text-muted/70 hover:border-brand-300 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand-200"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="Očisti pretragu"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted transition-colors hover:text-ink"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          )}
        </div>
        <ZavodSelect
          value={zavod}
          onChange={(v) => updateParam('zavod', v)}
          className="w-full sm:w-52"
        />
        <div
          role="group"
          aria-label="Sortiraj mentore"
          className="flex shrink-0 rounded border border-line bg-surface p-0.5"
        >
          {SORT_OPTIONS.map((opt) => {
            const active = (sort ?? '') === opt.value
            return (
              <button
                key={opt.value || 'default'}
                type="button"
                onClick={() => updateParam('sort', opt.value)}
                aria-pressed={active}
                className={`flex-1 whitespace-nowrap rounded px-3 py-2 text-xs font-semibold transition-colors sm:flex-none ${
                  active
                    ? 'bg-brand text-white'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex items-baseline justify-between border-b border-hairline pb-3">
        <h2 className="font-serif text-lg font-semibold text-ink">
          {filtered ? 'Rezultati' : 'Svi mentori'}
        </h2>
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
          {isPending ? 'Učitavanje…' : pluralMentori(total)}
        </p>
      </div>

      {isPending && (
        <>
          <LoadingStatus label="Učitavam mentore…" slow={slow} />
          <MentorListSkeleton />
        </>
      )}

      {isError && (
        <StateMessage
          tone="error"
          title="Pogreška pri učitavanju"
          description={error instanceof Error ? error.message : undefined}
        />
      )}

      {data && mentors.length === 0 && (
        <StateMessage
          title="Nema pronađenih mentora"
          description={
            urlQ
              ? `Nijedan mentor ne odgovara pretrazi „${urlQ}“. Pokušaj drugačije ime ili poništi filtre.`
              : 'Pokušaj odabrati drugi zavod ili poništiti filtar.'
          }
        />
      )}

      {mentors.length > 0 && (
        <>
          <ul className="grid gap-3 sm:grid-cols-2">
            {mentors.map((m) => (
              <li key={m.id}>
                <Link
                  to={`/mentor/${m.id}`}
                  state={back}
                  className="flex h-full flex-col justify-between rounded border border-hairline bg-surface p-4 transition-colors hover:border-brand hover:bg-section"
                >
                  <span className="font-serif text-lg font-semibold tracking-tightish text-ink">
                    {m.full_name}
                  </span>
                  <span className="mt-2 flex items-center gap-2">
                    {m.zavod_code && <Badge variant="zavod">{m.zavod_code}</Badge>}
                    <span className="text-xs text-muted">{pluralRadovi(m.n_theses)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="inline-flex items-center gap-2 rounded border border-line bg-surface px-6 py-2.5 text-sm font-semibold text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isFetchingNextPage ? 'Učitavam…' : 'Učitaj još'}
                {!isFetchingNextPage && <span aria-hidden="true">↓</span>}
              </button>
            </div>
          )}

          <p className="text-center font-mono text-xs uppercase tracking-[0.14em] text-muted">
            Prikazano {mentors.length} od {total}
          </p>
        </>
      )}
    </div>
  )
}
