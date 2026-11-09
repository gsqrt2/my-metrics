import { afterEach, describe, expect, it, vi } from 'vitest'

import { formatDuration, formatMemberCount } from '@/features/groups/format'

describe('formatDuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("uses the viewer's locale", () => {
    // Intl uses a thin space around the range dash in some versions.
    const normalize = (text: string) => text.replace(/\s/g, ' ')
    expect(normalize(formatDuration('2026-10-05', '2026-12-27', 'en-US'))).toBe(
      'Oct 5 – Dec 27, 2026',
    )
    expect(normalize(formatDuration('2026-10-05', '2026-12-27', 'de-DE'))).toBe(
      '05.10. – 27.12.2026',
    )
  })

  it('keeps the calendar days in any time zone', () => {
    vi.stubEnv('TZ', 'America/Los_Angeles')
    expect(formatDuration('2027-01-01', '2027-01-31', 'en-US')).toMatch(
      /^Jan 1\D+31, 2027$/,
    )
  })
})

describe('formatMemberCount', () => {
  it('counts members', () => {
    expect(formatMemberCount(1)).toBe('1 member')
    expect(formatMemberCount(3)).toBe('3 members')
  })
})
