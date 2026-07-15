import { useLocation } from 'react-router-dom'
import { useSimilarMentors } from '../api'
import { backState } from '../lib/backlink'
import { MentorTile } from './MentorTile'

/** "Studenti su također gledali" — mentors with the most similar thesis topics.
 * Secondary below-the-fold content: absent while loading, on error, or when
 * the backend has nothing to suggest. */
export function SimilarMentors({ mentorId }: { mentorId: number }) {
  const { data } = useSimilarMentors(mentorId)
  const location = useLocation()

  if (!data || data.length === 0) return null

  return (
    <section aria-label="Slični mentori">
      <h2 className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
        Studenti su također gledali
      </h2>
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
