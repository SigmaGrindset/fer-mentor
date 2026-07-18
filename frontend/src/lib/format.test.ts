import { describe, expect, it } from 'vitest'
import { formatDate } from './format'

describe('formatDate', () => {
  it('renders an ISO timestamp as a Croatian long date', () => {
    expect(formatDate('2026-07-18T09:15:22.123456+00:00')).toBe('18. srpnja 2026.')
  })

  it('uses the genitive month name', () => {
    expect(formatDate('2026-01-05T12:00:00+00:00')).toBe('5. siječnja 2026.')
  })
})
