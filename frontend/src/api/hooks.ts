/** TanStack Query hooks wrapping the API client. */
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query'
import {
  getMentor,
  getProgrammes,
  listMentors,
  listZavodi,
  recommend,
  recommendCourses,
} from './client'
import type { CourseRecommendRequest, MentorSort, RecommendRequest } from './types'

/** How many mentors to fetch per page in the browse list. */
export const MENTOR_PAGE_SIZE = 24

/** Recommend is a user-triggered action -> mutation. */
export function useRecommend() {
  return useMutation({
    mutationFn: (req: RecommendRequest) => recommend(req),
  })
}

export function useMentor(id: number | undefined) {
  return useQuery({
    queryKey: ['mentor', id],
    queryFn: () => getMentor(id as number),
    enabled: typeof id === 'number' && !Number.isNaN(id),
  })
}

/**
 * Paginated, filterable mentor browse list. Search (`q`), `zavod` and `sort` all
 * run server-side so they apply across all mentors, not just the loaded page.
 */
export function useMentorListInfinite(
  filters: { zavod?: string | null; q?: string | null; sort?: MentorSort | null } = {},
) {
  const zavod = filters.zavod ?? null
  const q = filters.q ?? null
  const sort = filters.sort ?? null
  return useInfiniteQuery({
    queryKey: ['mentors', zavod, q, sort],
    queryFn: ({ pageParam }) =>
      listMentors({ zavod, q, sort, limit: MENTOR_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((n, p) => n + p.mentors.length, 0)
      return loaded < lastPage.total ? loaded : undefined
    },
  })
}

/** Distinct departments (with mentor counts) for the filter dropdown. */
export function useZavodi() {
  return useQuery({
    queryKey: ['zavodi'],
    queryFn: () => listZavodi(),
    staleTime: 1000 * 60 * 60,
  })
}

/** Programme catalogue for the context selector. */
export function useProgrammes() {
  return useQuery({
    queryKey: ['programmes'],
    queryFn: () => getProgrammes(),
    staleTime: 1000 * 60 * 60, // catalogue rarely changes within a session
  })
}

/** Course recommendation is a user-triggered action -> mutation. */
export function useCourseRecommend() {
  return useMutation({
    mutationFn: (req: CourseRecommendRequest) => recommendCourses(req),
  })
}
