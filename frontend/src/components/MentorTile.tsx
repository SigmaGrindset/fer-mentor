import { Link } from 'react-router-dom'
import type { MentorSummary } from '../api'
import type { BackState } from '../lib/backlink'
import { pluralRadovi } from '../lib/format'

/** Compact mentor link card: name and thesis count. Used in the browse list
 * and the profile's "Mentori sa sličnim područjima rada" strip. */
export function MentorTile({ mentor, state }: { mentor: MentorSummary; state?: BackState }) {
  return (
    <Link
      to={`/mentor/${mentor.id}`}
      state={state}
      className="flex h-full flex-col justify-between rounded border border-hairline bg-surface p-4 transition-colors hover:border-brand hover:bg-section"
    >
      <span className="font-serif text-lg font-semibold tracking-tightish text-ink">
        {mentor.full_name}
      </span>
      <span className="mt-2 text-xs text-muted">{pluralRadovi(mentor.n_theses)}</span>
    </Link>
  )
}
