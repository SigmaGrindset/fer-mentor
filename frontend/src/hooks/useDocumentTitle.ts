import { useEffect } from 'react'

/** Kept in sync with <title> in index.html so the home route doesn't retitle on load. */
const DEFAULT_TITLE = 'FERmentor — pronađi mentora za svoj rad'
const SUFFIX = 'FERmentor'

/**
 * Sets `document.title` for the current route. Pass the page's own name; the
 * brand suffix is appended. Pass nothing for the home route's full brand title.
 *
 * Every route needs this — the title is what history entries, bookmarks and
 * screen readers announce on navigation, and an SPA never changes it on its own.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${SUFFIX}` : DEFAULT_TITLE
  }, [title])
}
