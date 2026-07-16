import { useSyncExternalStore } from 'react'
import {
  getSavedSnapshot,
  subscribeSaved,
  toggleSavedCourse,
  toggleSavedMentor,
} from '../lib/savedStore'
import type { SavedCourse, SavedMentor } from '../lib/savedStore'

/**
 * The shortlist ("Spremljeni"), live-synced across every component that
 * renders it — see `lib/savedStore.ts` for the store itself.
 */
export function useSaved() {
  const { mentors, courses } = useSyncExternalStore(subscribeSaved, getSavedSnapshot)

  return {
    mentors,
    courses,
    total: mentors.length + courses.length,
    isMentorSaved: (id: number) => mentors.some((m) => m.id === id),
    isCourseSaved: (id: number) => courses.some((c) => c.id === id),
    toggleMentor: (m: Omit<SavedMentor, 'savedAt'>) => toggleSavedMentor(m),
    toggleCourse: (c: Omit<SavedCourse, 'savedAt'>) => toggleSavedCourse(c),
  }
}
