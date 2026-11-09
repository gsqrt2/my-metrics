import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fromLocalInputValue,
  toLocalInputValue,
} from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { readLastUsed, rememberLastUsed } from '@/features/entries/last-used'
import { canLogFor } from '@/features/entries/permissions'
import {
  startingPoint,
  toLoggableGroups,
  type LoggableGroup,
} from '@/features/entries/use-loggable-groups'
import {
  commentError,
  measuredAtError,
  valueError,
} from '@/features/entries/validation'

const weight = { precision: 1, min_value: 2, max_value: 150 }

describe('valueError', () => {
  it('accepts empty input and numbers within the rules', () => {
    expect(valueError('', weight)).toBeUndefined()
    expect(valueError('72.4', weight)).toBeUndefined()
    expect(valueError('72,4', weight)).toBeUndefined()
    expect(valueError('150', weight)).toBeUndefined()
  })

  it('refuses text, too many decimals and values outside the limits', () => {
    expect(valueError('heavy', weight)).toBe('Enter a number.')
    expect(valueError('72.45', weight)).toBe('Use at most 1 decimal.')
    expect(valueError('72.5', { ...weight, precision: 0 })).toBe(
      'Use a whole number.',
    )
    expect(valueError('1.25', { ...weight, precision: 2, min_value: 2 })).toBe(
      'Use a value from 2 to 150.',
    )
    expect(valueError('720', weight, 'en-US')).toBe(
      'Use a value from 2 to 150.',
    )
    expect(valueError('-1', { ...weight, max_value: null })).toBe(
      'Use a value of at least 2.',
    )
  })

  it('allows any number, negatives included, without limits', () => {
    expect(
      valueError('-3.5', { precision: 1, min_value: null, max_value: null }),
    ).toBeUndefined()
  })
})

describe('measuredAtError', () => {
  const now = new Date(2026, 10, 9, 8, 0)

  it('needs a valid date and time', () => {
    expect(measuredAtError('', now)).toBe('Choose a date and time.')
    expect(measuredAtError('2026-11-09', now)).toBe('Choose a date and time.')
  })

  it('refuses the future, allowing a few minutes of clock skew', () => {
    expect(measuredAtError('2026-11-09T08:04', now)).toBeUndefined()
    expect(measuredAtError('2026-11-09T09:00', now)).toBe(
      "The time can't be in the future.",
    )
    expect(measuredAtError('2020-01-01T00:00', now)).toBeUndefined()
  })
})

describe('commentError', () => {
  it('allows up to 500 characters', () => {
    expect(commentError('x'.repeat(500))).toBeUndefined()
    expect(commentError('x'.repeat(501))).toBe('Use at most 500 characters.')
  })
})

describe('datetime-local values', () => {
  it('round-trip in local time, to the minute', () => {
    const date = new Date(2026, 0, 5, 23, 45, 30)
    expect(toLocalInputValue(date)).toBe('2026-01-05T23:45')
    expect(fromLocalInputValue('2026-01-05T23:45')).toEqual(
      new Date(2026, 0, 5, 23, 45),
    )
    expect(fromLocalInputValue('yesterday')).toBeNull()
  })
})

describe('formatValue', () => {
  it("shows the attribute's decimals and unit", () => {
    expect(formatValue(72.4, { precision: 1, unit: 'kg' }, 'en-US')).toBe(
      '72.4 kg',
    )
    expect(formatValue(72, { precision: 1, unit: 'kg' }, 'de-DE')).toBe(
      '72,0 kg',
    )
    expect(formatValue(7, { precision: 0, unit: null }, 'en-US')).toBe('7')
  })
})

describe('canLogFor (§5)', () => {
  const group = {
    role: 'editor' as const,
    membersEditOwnSubjectOnly: false,
    isArchived: false,
  }
  const mia = { linked_user_id: null, archived_at: null }
  const mine = { linked_user_id: 'me', archived_at: null }

  it('lets owners and editors log for any subject', () => {
    expect(canLogFor(group, mia, 'me')).toBe(true)
    expect(canLogFor({ ...group, role: 'owner' }, mia, 'me')).toBe(true)
  })

  it('lets viewers log only for their own subject', () => {
    expect(canLogFor({ ...group, role: 'viewer' }, mia, 'me')).toBe(false)
    expect(canLogFor({ ...group, role: 'viewer' }, mine, 'me')).toBe(true)
  })

  it('limits everyone to their own subject when the group says so', () => {
    const own = {
      ...group,
      role: 'owner' as const,
      membersEditOwnSubjectOnly: true,
    }
    expect(canLogFor(own, mia, 'me')).toBe(false)
    expect(canLogFor(own, mine, 'me')).toBe(true)
  })

  it('refuses archived subjects and groups', () => {
    expect(canLogFor(group, { ...mine, archived_at: '2026-01-01' }, 'me')).toBe(
      false,
    )
    expect(canLogFor({ ...group, isArchived: true }, mine, 'me')).toBe(false)
  })
})

describe('toLoggableGroups', () => {
  const attribute = {
    id: 'a1',
    name: 'Weight',
    unit: 'kg',
    precision: 1,
    min_value: null,
    max_value: null,
    sort_order: 1,
    archived_at: null,
  }
  const row = {
    id: 'g1',
    name: 'Kids',
    default_for_user_id: null,
    members_edit_own_subject_only: false,
    archived_at: null,
    me: [{ role: 'editor' as const }],
    subjects: [
      {
        id: 's2',
        name: 'Noah',
        color: 'orange' as const,
        linked_user_id: null,
        archived_at: null,
      },
      {
        id: 's1',
        name: 'Mia',
        color: 'blue' as const,
        linked_user_id: null,
        archived_at: null,
      },
      {
        id: 's3',
        name: 'Old',
        color: 'aqua' as const,
        linked_user_id: null,
        archived_at: '2026-01-01',
      },
      {
        id: 's4',
        name: 'Zed',
        color: 'red' as const,
        linked_user_id: 'me',
        archived_at: null,
      },
    ],
    attributes: [
      { ...attribute, id: 'a2', name: 'Height', sort_order: 0 },
      attribute,
      {
        ...attribute,
        id: 'a3',
        name: 'Old',
        sort_order: 2,
        archived_at: '2026-01-01',
      },
    ],
  }

  it('keeps active attributes in order and loggable subjects, own first', () => {
    const [group] = toLoggableGroups([row], 'me')
    expect(group.attributes.map((a) => a.name)).toEqual(['Height', 'Weight'])
    expect(group.subjects.map((s) => s.name)).toEqual(['Zed', 'Mia', 'Noah'])
  })

  it('leaves out groups without attributes or without loggable subjects', () => {
    expect(toLoggableGroups([{ ...row, attributes: [] }], 'me')).toEqual([])
    expect(
      toLoggableGroups(
        [
          {
            ...row,
            me: [{ role: 'viewer' }],
            subjects: row.subjects.slice(0, 2),
          },
        ],
        'me',
      ),
    ).toEqual([])
  })
})

describe('startingPoint (agreed "Log entry" flow)', () => {
  const kids: LoggableGroup = {
    id: 'kids',
    name: 'Kids',
    subjects: [
      { id: 'mia', name: 'Mia', color: 'blue', linked_user_id: null },
      { id: 'noah', name: 'Noah', color: 'orange', linked_user_id: null },
    ],
    attributes: [],
  }
  const diet: LoggableGroup = {
    id: 'diet',
    name: 'Diet',
    subjects: [
      { id: 'kim', name: 'Kim', color: 'blue', linked_user_id: 'kim-user' },
      { id: 'me', name: 'Me', color: 'orange', linked_user_id: 'me-user' },
    ],
    attributes: [],
  }
  const base = { lastSubjectByGroup: {}, userId: 'me-user' }

  it('starts in the logbook it was opened from', () => {
    expect(
      startingPoint([kids, diet], {
        ...base,
        presetGroupId: 'diet',
        lastGroupId: 'kids',
      }),
    ).toEqual({ groupId: 'diet', subjectId: 'me' })
  })

  it('otherwise in the last logbook used', () => {
    expect(
      startingPoint([kids, diet], { ...base, lastGroupId: 'diet' }),
    ).toEqual({ groupId: 'diet', subjectId: 'me' })
  })

  it('always starts with a logbook: the first one when nothing else applies', () => {
    expect(startingPoint([kids, diet], base)).toEqual({
      groupId: 'kids',
      subjectId: 'mia',
    })
    expect(startingPoint([], base)).toEqual({ groupId: '', subjectId: '' })
  })

  it("falls back when the preset logbook can't be logged in", () => {
    expect(
      startingPoint([kids, diet], {
        ...base,
        presetGroupId: 'gone',
        lastGroupId: 'diet',
      }),
    ).toEqual({ groupId: 'diet', subjectId: 'me' })
    expect(
      startingPoint([kids, diet], { ...base, presetGroupId: 'gone' }),
    ).toEqual({ groupId: 'kids', subjectId: 'mia' })
  })

  it("picks the user's own participant, else the last used, else the first", () => {
    expect(
      startingPoint([kids, diet], {
        ...base,
        presetGroupId: 'diet',
        lastSubjectByGroup: { diet: 'kim' },
      }).subjectId,
    ).toBe('me')
    expect(
      startingPoint([kids, diet], {
        ...base,
        presetGroupId: 'kids',
        lastSubjectByGroup: { kids: 'noah' },
      }).subjectId,
    ).toBe('noah')
  })
})

describe('last used logbook and participant', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('are remembered per user', () => {
    rememberLastUsed('u1', 'kids', 'mia')
    rememberLastUsed('u1', 'diet', 'me')
    expect(readLastUsed('u1')).toEqual({
      groupId: 'diet',
      subjectByGroup: { kids: 'mia', diet: 'me' },
    })
    expect(readLastUsed('u2')).toEqual({ subjectByGroup: {} })
  })

  it('fall back to nothing when storage is unavailable or garbled', () => {
    localStorage.setItem('my-metrics:last-logged:u1', '{not json')
    expect(readLastUsed('u1')).toEqual({ subjectByGroup: {} })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(() => rememberLastUsed('u1', 'kids', 'mia')).not.toThrow()
  })
})
