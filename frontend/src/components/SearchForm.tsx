import { useState } from 'react'
import { ZavodSelect } from './ZavodSelect'

export interface SearchValues {
  query: string
  zavod: string
}

const EXAMPLES = [
  'Računalni vid i prepoznavanje objekata',
  'Web-aplikacija s React sučeljem i REST-om',
  'Obrada prirodnog jezika i veliki jezični modeli',
  'Sigurnost mreža i detekcija napada',
]

export function SearchForm({
  initialQuery = '',
  initialZavod = '',
  pending,
  onSubmit,
}: {
  initialQuery?: string
  initialZavod?: string
  pending: boolean
  onSubmit: (values: SearchValues) => void
}) {
  const [query, setQuery] = useState(initialQuery)
  const [zavod, setZavod] = useState(initialZavod)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    onSubmit({ query: trimmed, zavod })
  }

  return (
    <form
      onSubmit={submit}
      className="rounded border border-hairline bg-surface p-6 shadow-[0_1px_0_rgba(22,32,30,0.04)] sm:p-7"
    >
      <label
        htmlFor="topic"
        className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted"
      >
        Opiši temu
      </label>
      <textarea
        id="topic"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submit(e)
        }}
        rows={3}
        placeholder="npr. razvoj web-aplikacije za vizualizaciju podataka u stvarnom vremenu…"
        className="mt-3 w-full resize-y border-0 border-b border-line bg-transparent px-0 py-2 font-serif text-xl leading-snug text-ink placeholder:font-sans placeholder:text-base placeholder:text-muted/70 focus:border-brand focus:outline-none focus:ring-0"
      />

      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label htmlFor="zavod" className="text-sm text-muted">
            Zavod
          </label>
          <ZavodSelect value={zavod} onChange={setZavod} />
        </div>

        <button
          type="submit"
          disabled={pending || query.trim().length === 0}
          className="inline-flex items-center justify-center gap-2 rounded bg-brand px-7 py-3 text-sm font-semibold tracking-wide text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? 'Tražim…' : 'Pronađi mentore'}
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
  )
}
