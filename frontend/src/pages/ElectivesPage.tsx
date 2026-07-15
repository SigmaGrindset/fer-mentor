import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useCourseRecommend, useProgrammes } from '../api'
import type { ProgrammeOut } from '../api'
import { CourseCard } from '../components/CourseCard'
import { RecentSearches } from '../components/RecentSearches'
import { Select, type SelectGroup, type SelectOption } from '../components/Select'
import { ResultListSkeleton } from '../components/Skeleton'
import { StateMessage } from '../components/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { RECENT_ELECTIVES, useRecentSearches } from '../hooks/useRecentSearches'
import { pluralRezultati } from '../lib/format'

type Level = 'preddiplomski' | 'diplomski'

const AREA_LABEL: Record<string, string> = {
  Računarstvo: 'Računarstvo',
  EIT: 'Elektrotehnika i informacijska tehnologija',
  IKT: 'Informacijska i komunikacijska tehnologija',
}

const EXAMPLES = [
  'Strojno učenje i obrada slike',
  'Razvoj web i mobilnih aplikacija',
  'Računalne mreže i sigurnost',
  'Ugradbeni sustavi i robotika',
]

export function ElectivesPage() {
  useDocumentTitle('Izborni predmeti')
  const { data: catalog, isPending: loadingProgrammes } = useProgrammes()
  const recommend = useCourseRecommend()
  const { recent, add, remove } = useRecentSearches(RECENT_ELECTIVES)

  // Form state is hydrated from the URL so a search is shareable/bookmarkable.
  const [params, setParams] = useSearchParams()
  const [level, setLevel] = useState<Level>(
    params.get('razina') === 'diplomski' ? 'diplomski' : 'preddiplomski',
  )
  const [programmeCode, setProgrammeCode] = useState(params.get('smjer') ?? '')
  const [semester, setSemester] = useState<string>(params.get('sem') ?? '')
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [submittedQuery, setSubmittedQuery] = useState<string | null>(null)
  const autoRan = useRef(false)

  const programmes = catalog?.programmes ?? []
  const inLevel = useMemo(
    () => programmes.filter((p) => p.level === level),
    [programmes, level],
  )

  // Group diplomski profiles by area for the <optgroup> selector.
  const byArea = useMemo(() => {
    const map = new Map<string, ProgrammeOut[]>()
    for (const p of inLevel) {
      const key = p.area ?? '—'
      ;(map.get(key) ?? map.set(key, []).get(key)!).push(p)
    }
    return map
  }, [inLevel])

  // Keep a valid programme selected when the catalogue loads or level changes.
  // (State-only; no network call here — safe under StrictMode.)
  useEffect(() => {
    if (inLevel.length === 0) return
    if (!inLevel.some((p) => p.code === programmeCode)) {
      setProgrammeCode(inLevel[0].code)
    }
  }, [inLevel, programmeCode])

  function search(q: string) {
    recommend.mutate({
      query: q,
      programme_code: programmeCode,
      semester: semester === '' ? null : Number(semester),
      top_k: 12,
    })
  }

  // Auto-run once from a shared/bookmarked URL (?q=&smjer=…), after the
  // catalogue has loaded and a valid programme is resolved. Ref-guarded so it
  // fires a single time (StrictMode-safe).
  useEffect(() => {
    if (autoRan.current) return
    const q = (params.get('q') ?? '').trim()
    if (!q || !programmeCode || inLevel.length === 0) return
    autoRan.current = true
    setSubmittedQuery(q)
    add(q)
    search(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programmeCode, inLevel])

  const semesterOptions = level === 'preddiplomski' ? [5, 6] : [1, 2, 3, 4]

  // Options for the modern Select: flat list for preddiplomski, grouped by
  // area for diplomski profiles.
  const programmeFlat = useMemo<SelectOption[]>(
    () => inLevel.map((p) => ({ value: p.code, label: p.name })),
    [inLevel],
  )
  const programmeGroups = useMemo<SelectGroup[]>(
    () =>
      [...byArea.entries()].map(([area, progs]) => ({
        label: AREA_LABEL[area] ?? area,
        options: progs.map((p) => ({ value: p.code, label: p.name })),
      })),
    [byArea],
  )
  const semesterSelectOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Svi semestri' },
      ...semesterOptions.map((s) => ({ value: String(s), label: `${s}. semestar` })),
    ],
    [semesterOptions],
  )

  function changeLevel(next: Level) {
    setLevel(next)
    setSemester('')
  }

  function run(rawQuery: string) {
    const q = rawQuery.trim()
    if (!q || !programmeCode) return
    setSubmittedQuery(q)
    add(q)
    const next = new URLSearchParams()
    next.set('razina', level)
    next.set('smjer', programmeCode)
    if (semester) next.set('sem', semester)
    next.set('q', q)
    setParams(next, { replace: true })
    search(q)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    run(query)
  }

  function pickRecent(q: string) {
    setQuery(q)
    run(q)
  }

  const results = recommend.data?.results ?? []

  return (
    <div className="space-y-10">
      <section className="max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-brand">
          Preporuka izbornih predmeta
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold leading-[1.05] tracking-tightish text-ink sm:text-5xl">
          Pronađi izborne predmete.
        </h1>
        <p className="mt-5 max-w-prose text-[1.05rem] leading-relaxed text-muted">
          Odaberi svoj studij i opiši što te zanima — FERmentor predlaže izborne
          predmete koje stvarno možeš upisati, poredane po tome koliko se njihovi
          ishodi poklapaju s tvojim interesima.
        </p>
      </section>

      <form
        onSubmit={submit}
        className="rounded border border-hairline bg-surface p-6 shadow-[0_1px_0_rgba(22,32,30,0.04)] sm:p-7"
      >
        {/* Razina — segmented control */}
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
          Razina studija
        </span>
        <div className="mt-2 inline-flex rounded border border-line p-0.5">
          {(['preddiplomski', 'diplomski'] as Level[]).map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => changeLevel(lvl)}
              className={`rounded px-4 py-1.5 text-sm font-semibold capitalize transition-colors ${
                level === lvl ? 'bg-brand text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Smjer / profil + semestar */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="programme" className="text-sm text-muted">
              {level === 'preddiplomski' ? 'Smjer' : 'Profil diplomskog studija'}
            </label>
            <Select
              id="programme"
              value={programmeCode}
              onChange={setProgrammeCode}
              disabled={loadingProgrammes}
              placeholder={loadingProgrammes ? 'Učitavanje…' : 'Odaberi studij'}
              ariaLabel={level === 'preddiplomski' ? 'Smjer' : 'Profil diplomskog studija'}
              className="w-full"
              {...(level === 'preddiplomski'
                ? { options: programmeFlat }
                : { groups: programmeGroups })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="semester" className="text-sm text-muted">
              Semestar <span className="text-muted/60">(neobavezno)</span>
            </label>
            <Select
              id="semester"
              value={semester}
              onChange={setSemester}
              options={semesterSelectOptions}
              ariaLabel="Semestar"
              className="w-full"
            />
          </div>
        </div>

        {/* Interes */}
        <div className="mt-5">
          <label
            htmlFor="interest"
            className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted"
          >
            Opiši svoj interes
          </label>
          <textarea
            id="interest"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
            }}
            rows={3}
            placeholder="npr. zanima me umjetna inteligencija i obrada slike za medicinske primjene…"
            className="mt-3 w-full resize-y border-0 border-b border-line bg-transparent px-0 py-2 font-serif text-xl leading-snug text-ink placeholder:font-sans placeholder:text-base placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-0"
          />
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={recommend.isPending || query.trim().length === 0 || !programmeCode}
            className="inline-flex items-center justify-center gap-2 rounded bg-brand px-7 py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {recommend.isPending ? 'Tražim…' : 'Pronađi izborne'}
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <div className="mt-6 border-t border-hairline pt-4">
          <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
            Probaj
          </span>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setQuery(ex)}
                className="text-left text-sm text-brand decoration-brand-200 underline-offset-4 transition-colors hover:text-brand-dark hover:underline"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      </form>

      <RecentSearches items={recent} onPick={pickRecent} onRemove={remove} />

      <section aria-live="polite">
        {recommend.isPending && (
          <>
            <span className="sr-only" role="status">
              Pretražujem izborne predmete…
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
                : 'Pokušaj ponovno za nekoliko trenutaka.'
            }
          >
            <button
              type="button"
              onClick={() => submittedQuery && search(submittedQuery)}
              className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Pokušaj ponovno
            </button>
          </StateMessage>
        )}

        {recommend.isSuccess && results.length === 0 && (
          <StateMessage
            title="Nema pronađenih izbornih predmeta"
            description="Za odabrani studij/semestar nema izbornih predmeta ili pokušaj preformulirati interes."
          />
        )}

        {recommend.isSuccess && results.length > 0 && (
          <div>
            <div className="flex items-baseline justify-between border-b border-hairline pb-3">
              <h2 className="font-serif text-xl font-semibold text-ink">Predloženi izborni predmeti</h2>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
                {pluralRezultati(results.length)}
              </p>
            </div>
            {submittedQuery && (
              <p className="mt-3 text-sm text-muted">
                za interes „<span className="text-ink">{submittedQuery}</span>“
              </p>
            )}
            <div className="mt-6 space-y-5">
              {results.map((course, i) => (
                <CourseCard key={course.course_id} course={course} rank={i + 1} />
              ))}
            </div>
          </div>
        )}

        {recommend.isIdle && (
          <StateMessage
            title="Spremni za pretragu"
            description="Odaberi studij i opiši interes iznad, pa pritisni „Pronađi izborne“."
          />
        )}
      </section>
    </div>
  )
}
