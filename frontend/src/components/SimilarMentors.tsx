import { useLocation } from 'react-router-dom'
import { useSimilarMentors } from '../api'
import { backState } from '../lib/backlink'
import { MentorTile } from './MentorTile'
import { MentorListSkeleton } from './Skeleton'

const heading = (
  <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
    Studenti su također gledali
  </h2>
)

/** "Studenti su također gledali" — mentors with the most similar thesis topics.
 * Sits above the thesis list, so it reserves its height with a skeleton while
 * loading (no shove-down when data lands) and collapses to nothing on error or
 * when the backend has no suggestions. */
export function SimilarMentors({ mentorId }: { mentorId: number }) {
  const { data, isPending } = useSimilarMentors(mentorId)
  const location = useLocation()

  if (isPending) {
    return (
      <section aria-label="Slični mentori">
        {heading}
        <div className="mt-3">
          <MentorListSkeleton count={6} />
        </div>
      </section>
    )
  }

  if (!data || data.length === 0) return null

  return (
    <section aria-label="Slični mentori">
      {heading}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2">
        {data.map((m) => (
          <li key={m.id}>
            <MentorTile mentor={m} state={backState(location)} />
          </li>
        ))}
      </ul>
    </section>
  )
}
