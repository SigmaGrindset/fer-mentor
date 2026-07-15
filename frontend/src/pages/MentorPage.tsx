import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError, useMentor } from '../api'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { Badge } from '../components/Badge'
import { MentorDetailSkeleton } from '../components/Skeleton'
import { SimilarMentors } from '../components/SimilarMentors'
import { LoadingStatus, StateMessage } from '../components/StateMessage'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSlowRequest } from '../hooks/useSlowRequest'
import { backTarget } from '../lib/backlink'
import { formatThesisType, pluralRadovi } from '../lib/format'

export function MentorPage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : undefined
  const { data, isPending, isError, error } = useMentor(numericId)
  const slow = useSlowRequest(isPending)

  // Return to the search/list we came from, filters intact; the recommender is
  // the fallback for profiles opened directly (shared link, new tab).
  const backTo = backTarget(useLocation().state) ?? '/'
  const backLabel = backTo.startsWith('/mentori') ? 'Natrag na popis mentora' : 'Natrag na pretragu'

  const notFound = isError && error instanceof ApiError && error.status === 404

  // The name arrives with the fetch, so the title settles a beat after navigation.
  useDocumentTitle(data?.full_name ?? (notFound ? 'Mentor nije pronađen' : 'Profil mentora'))

  return (
    <div className="space-y-8">
      <Link
        to={backTo}
        className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.12em] text-muted transition-colors hover:text-brand"
      >
        ← {backLabel}
      </Link>

      {isPending && (
        <>
          <LoadingStatus label="Učitavam profil mentora…" slow={slow} />
          <MentorDetailSkeleton />
        </>
      )}

      {notFound && (
        <StateMessage
          title="Mentor nije pronađen"
          description="Traženi mentor ne postoji ili je uklonjen."
        >
          <Link
            to="/mentori"
            className="rounded bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Pregledaj sve mentore
          </Link>
        </StateMessage>
      )}

      {isError && !notFound && (
        <StateMessage
          tone="error"
          title="Pogreška pri učitavanju profila"
          description={error instanceof Error ? error.message : undefined}
        />
      )}

      {data && (
        <>
          <header className="border-b border-hairline pb-6">
            {data.zavod_code && (
              <span className="font-mono text-[0.72rem] uppercase tracking-[0.12em] text-brand">
                {data.zavod_code}
              </span>
            )}
            <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tightish text-ink sm:text-4xl">
              {data.full_name}
            </h1>
            <p className="mt-2 text-sm text-muted">{pluralRadovi(data.n_theses)}</p>

            <ActivityTimeline theses={data.theses} />

            {data.scientific_fields.length > 0 && (
              <div className="mt-5">
                <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  Znanstvena područja
                </h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {data.scientific_fields.map((field) => (
                    <Badge key={field} variant="type">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </header>

          <section>
            <h2 className="font-serif text-xl font-semibold text-ink">
              Radovi <span className="font-sans text-base font-normal text-muted">({data.theses.length})</span>
            </h2>
            {data.theses.length === 0 ? (
              <div className="mt-4">
                <StateMessage title="Nema zabilježenih radova za ovog mentora." />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
                {data.theses.map((thesis) => (
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
            )}
          </section>

          <SimilarMentors mentorId={data.id} />
        </>
      )}
    </div>
  )
}
