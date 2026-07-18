import { describe, expect, it } from 'vitest'
import { formatDate, pluralMentori, pluralRadovi, pluralRezultati } from './format'

describe('formatDate', () => {
  it('renders an ISO timestamp as a Croatian long date', () => {
    expect(formatDate('2026-07-18T09:15:22.123456+00:00')).toBe('18. srpnja 2026.')
  })

  it('uses the genitive month name', () => {
    expect(formatDate('2026-01-05T12:00:00+00:00')).toBe('5. siječnja 2026.')
  })
})

describe('Croatian pluralization', () => {
  it('uses the singular for 1, 21, 101', () => {
    expect(pluralRezultati(1)).toBe('1 rezultat')
    expect(pluralRezultati(21)).toBe('21 rezultat')
    expect(pluralRadovi(101)).toBe('101 rad')
  })

  it('uses the paucal for 2-4 and 22-24', () => {
    expect(pluralRadovi(2)).toBe('2 rada')
    expect(pluralRadovi(3)).toBe('3 rada')
    expect(pluralRadovi(4)).toBe('4 rada')
    expect(pluralRadovi(24)).toBe('24 rada')
    expect(pluralRezultati(3)).toBe('3 rezultata')
  })

  it('uses the plural for 5+ ', () => {
    expect(pluralRadovi(5)).toBe('5 radova')
    expect(pluralRadovi(100)).toBe('100 radova')
    expect(pluralMentori(7)).toBe('7 mentora')
  })

  it('11-14 take the plural despite ending in 1-4', () => {
    expect(pluralRadovi(11)).toBe('11 radova')
    expect(pluralRadovi(12)).toBe('12 radova')
    expect(pluralRadovi(13)).toBe('13 radova')
    expect(pluralRadovi(14)).toBe('14 radova')
    expect(pluralRezultati(111)).toBe('111 rezultata')
  })

  it('0 takes the plural', () => {
    expect(pluralRadovi(0)).toBe('0 radova')
  })
})
