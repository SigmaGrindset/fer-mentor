import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError, useMentor } from '../api'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { Badge } from '../components/Badge'
import { MentorDetailSkeleton } from '../components/Skeleton'
import { SimilarMentors } from '../components/SimilarMentors'
import { LoadingStatus, StateMessage } from '../components/StateMessage'
import { ThesisList } from '../components/ThesisList'
import { BookmarkButton } from '../components/BookmarkButton'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useSaved } from '../hooks/useSaved'
import { useSlowRequest } from '../hooks/useSlowRequest'
import { backTarget } from '../lib/backlink'
import { ferProfileUrl } from '../lib/ferProfile'
import { pluralRadovi } from '../lib/format'

export function MentorPage() {
  const { id } = useParams<{ id: string }>()
  const numericId = id ? Number(id) : undefined
  const { data, isPending, isError, error } = useMentor(numericId)
  const slow = useSlowRequest(isPending)
  const { isMentorSaved, toggleMentor } = useSaved()

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
            <div className="mt-2 flex items-start justify-between gap-4">
              <h1 className="font-serif text-3xl font-semibold tracking-tightish text-ink sm:text-4xl">
                {data.full_name}
              </h1>
              <BookmarkButton
                saved={isMentorSaved(data.id)}
                onToggle={() =>
                  toggleMentor({
                    id: data.id,
                    full_name: data.full_name,
                    zavod_code: data.zavod_code,
                    n_theses: data.n_theses,
                  })
                }
                itemLabel={data.full_name}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <p className="text-sm text-muted">{pluralRadovi(data.n_theses)}</p>
              <a
                href={ferProfileUrl(data.full_name)}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-brand decoration-brand-200 underline-offset-4 hover:text-brand-dark hover:underline"
              >
                Profil na fer.unizg.hr ↗
              </a>
            </div>

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

          <SimilarMentors mentorId={data.id} />

          {/* Keyed by mentor: hopping to a similar mentor must reseed the
              filter input from the fresh (param-less) URL, not keep old text. */}
          <ThesisList key={data.id} theses={data.theses} />
        </>
      )}
    </div>
  )
}
