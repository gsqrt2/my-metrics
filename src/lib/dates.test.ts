import { describe, expect, it } from 'vitest'

import {
  dayTextToIso,
  formatDate,
  formatDateTime,
  isoToDayText,
  parseTime,
} from '@/lib/dates'

describe('formatting', () => {
  it('shows dd/mm/yyyy and 24-hour times', () => {
    expect(formatDate(new Date(2026, 10, 9))).toBe('09/11/2026')
    expect(formatDateTime(new Date(2026, 10, 9, 19, 5))).toBe(
      '09/11/2026, 19:05',
    )
  })
})

describe('typed dates', () => {
  it('reads dd/mm/yyyy, with one-digit parts and dots or dashes', () => {
    expect(dayTextToIso('05/10/2026')).toBe('2026-10-05')
    expect(dayTextToIso(' 5/10/2026 ')).toBe('2026-10-05')
    expect(dayTextToIso('5.1.2026')).toBe('2026-01-05')
    expect(dayTextToIso('5-1-2026')).toBe('2026-01-05')
  })

  it('gives empty for empty and null for what is not a real date', () => {
    expect(dayTextToIso('')).toBe('')
    expect(dayTextToIso('31/02/2026')).toBeNull()
    expect(dayTextToIso('2026-10-05')).toBeNull()
    expect(dayTextToIso('05/10/26')).toBeNull()
    expect(dayTextToIso('13/13/2026')).toBeNull()
  })

  it('round-trips', () => {
    expect(isoToDayText('2026-10-05')).toBe('05/10/2026')
    expect(isoToDayText('')).toBe('')
  })
})

describe('typed times', () => {
  it('reads hh:mm in 24 hours', () => {
    expect(parseTime('7:05')).toBe('07:05')
    expect(parseTime('19.30')).toBe('19:30')
    expect(parseTime('24:00')).toBeNull()
    expect(parseTime('7')).toBeNull()
  })
})
