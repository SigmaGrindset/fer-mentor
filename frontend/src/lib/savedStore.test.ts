import { describe, expect, it } from 'vitest'
import {
  SAVED_MENTORS_KEY,
  getSavedSnapshot,
  toggleSavedCourse,
  toggleSavedMentor,
} from './savedStore'

const mentor = (id: number) => ({
  id,
  full_name: `Mentor ${id}`,
  zavod_code: 'ZEMRIS',
  n_theses: 3,
})

describe('savedStore', () => {
  it('toggling adds, then removes, a mentor', () => {
    toggleSavedMentor(mentor(101))
    expect(getSavedSnapshot().mentors.some((m) => m.id === 101)).toBe(true)

    toggleSavedMentor(mentor(101))
    expect(getSavedSnapshot().mentors.some((m) => m.id === 101)).toBe(false)
  })

  it('persists saved mentors to localStorage', () => {
    toggleSavedMentor(mentor(102))
    const raw = localStorage.getItem(SAVED_MENTORS_KEY)
    expect(raw).not.toBeNull()
    const parsed = JSON.parse(raw as string) as Array<{ id: number; savedAt: number }>
    const entry = parsed.find((e) => e.id === 102)
    expect(entry).toBeDefined()
    expect(typeof entry?.savedAt).toBe('number')
    toggleSavedMentor(mentor(102)) // leave the store clean
  })

  it('newest saves come first', () => {
    toggleSavedMentor(mentor(103))
    toggleSavedMentor(mentor(104))
    const ids = getSavedSnapshot().mentors.map((m) => m.id)
    expect(ids.indexOf(104)).toBeLessThan(ids.indexOf(103))
    toggleSavedMentor(mentor(103))
    toggleSavedMentor(mentor(104))
  })

  it('mentors and courses are stored independently', () => {
    toggleSavedCourse({ id: 7, code: 'dubuce', name: 'Duboko učenje', ects: 5 })
    expect(getSavedSnapshot().courses.some((c) => c.id === 7)).toBe(true)
    expect(getSavedSnapshot().mentors.some((m) => m.id === 7)).toBe(false)
    toggleSavedCourse({ id: 7, code: 'dubuce', name: 'Duboko učenje', ects: 5 })
  })
})
