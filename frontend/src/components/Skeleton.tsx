/**
 * Loading skeletons that mirror the real result layouts, so swapping in real
 * content causes no layout shift. Decorative only — `aria-hidden`; pages keep a
 * visually-hidden `role="status"` for screen readers.
 */

const bar = 'rounded bg-line/60'

/** One recommendation card (mentor or course): rank · title/meta · score · text. */
export function ResultCardSkeleton() {
  return (
    <div
      className="animate-pulse rounded border border-hairline bg-surface p-6 shadow-[0_1px_0_rgba(22,32,30,0.04)]"
      aria-hidden="true"
    >
      <div className="flex gap-5">
        <div className={`hidden h-7 w-7 shrink-0 sm:block ${bar}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1 space-y-2">
              <div className={`h-5 w-1/2 ${bar}`} />
              <div className={`h-3 w-1/3 ${bar}`} />
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <div className={`h-6 w-12 ${bar}`} />
              <div className="h-1 w-24 rounded-full bg-section" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className={`h-3 w-full ${bar}`} />
            <div className={`h-3 w-4/5 ${bar}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

/** A list of result cards (search / electives pending state). */
export function ResultListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ResultCardSkeleton key={i} />
      ))}
    </div>
  )
}

/** Grid of compact mentor cards (mentor list pending state). */
export function MentorListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i} className="animate-pulse rounded border border-hairline bg-surface p-4">
          <div className={`h-5 w-2/3 ${bar}`} />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-14 rounded bg-section" />
            <div className={`h-3 w-16 ${bar}`} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Mentor profile: header (chip · name · meta · fields) + thesis rows. */
export function MentorDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-8" aria-hidden="true">
      <div className="border-b border-hairline pb-6">
        <div className={`h-3 w-20 ${bar}`} />
        <div className={`mt-3 h-8 w-2/3 ${bar}`} />
        <div className="mt-3 h-3 w-24 rounded bg-section" />
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="h-6 w-24 rounded bg-section" />
          <div className="h-6 w-20 rounded bg-section" />
          <div className="h-6 w-28 rounded bg-section" />
        </div>
      </div>
      <div>
        <div className={`h-6 w-32 ${bar}`} />
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline">
          {Array.from({ length: 5 }).map((_, i) => (
            <li key={i} className="py-4">
              <div className={`h-4 w-3/4 ${bar}`} />
              <div className="mt-2 h-3 w-1/3 rounded bg-section" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
