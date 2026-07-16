/** Bookmark toggle for the shortlist: outline when unsaved, filled when saved. */
export function BookmarkButton({
  saved,
  onToggle,
  itemLabel,
}: {
  saved: boolean
  onToggle: () => void
  itemLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={saved}
      aria-label={saved ? `Ukloni iz spremljenih: ${itemLabel}` : `Spremi: ${itemLabel}`}
      title={saved ? 'Ukloni iz spremljenih' : 'Spremi'}
      className={`rounded p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-brand-200 ${
        saved ? 'text-brand hover:text-brand-dark' : 'text-muted hover:text-brand'
      }`}
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5.75 3.75h8.5a1 1 0 0 1 1 1v11.3a.4.4 0 0 1-.62.33L10 13.25l-4.63 3.13a.4.4 0 0 1-.62-.33V4.75a1 1 0 0 1 1-1Z" />
      </svg>
    </button>
  )
}
