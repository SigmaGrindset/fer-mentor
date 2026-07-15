/** Carries the originating list/search URL into a detail page, so "back" returns to it. */

import type { Location } from 'react-router-dom'

export type BackState = { from: string }

/** Attach to a <Link> into a detail page: remembers the current path + query. */
export function backState(location: Pick<Location, 'pathname' | 'search'>): BackState {
  return { from: `${location.pathname}${location.search}` }
}

/** Read the origin back out of history state, or null when we didn't come from within the app. */
export function backTarget(state: unknown): string | null {
  const from = (state as Partial<BackState> | null)?.from
  if (typeof from !== 'string') return null
  // History state survives reloads and isn't necessarily ours, so only follow an
  // app-relative path — "//host" would render an <a> that leaves the site.
  if (!from.startsWith('/') || from.startsWith('//')) return null
  return from
}
