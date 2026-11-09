import { describe, expect, it } from 'vitest'

import { formatAge, todayIso } from '@/features/subjects/age'
import { nextSubjectColor } from '@/features/subjects/colors'
import { initials } from '@/features/subjects/initials'
import {
  subjectSchema,
  toSubjectForm,
  toSubjectRow,
  type SubjectFormValues,
} from '@/features/subjects/schemas'

const today = '2026-11-09'

function errors(values: Partial<SubjectFormValues>) {
  const result = subjectSchema(today).safeParse({
    name: 'Mia',
    birthdate: '',
    color: 'blue',
    ...values,
  })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('subject form', () => {
  it('needs a name of up to 80 characters', () => {
    expect(errors({ name: '  ' })).toEqual({ name: 'Enter a name.' })
    expect(errors({ name: 'x'.repeat(81) })).toEqual({
      name: 'Use at most 80 characters.',
    })
  })

  it('takes an optional birthdate between 1900 and today', () => {
    expect(errors({ birthdate: '' })).toEqual({})
    expect(errors({ birthdate: today })).toEqual({})
    expect(errors({ birthdate: '2026-11-10' })).toEqual({
      birthdate: "A birthdate can't be in the future.",
    })
    expect(errors({ birthdate: '1899-12-31' })).toEqual({
      birthdate: 'Use a date in 1900 or later.',
    })
  })

  it('only takes palette colours', () => {
    expect(errors({ color: 'black' as never })).toHaveProperty('color')
  })

  it('saves trimmed names and no birthdate as none', () => {
    const values = subjectSchema(today).parse({
      name: ' Noah ',
      birthdate: '',
      color: 'orange',
    })
    expect(toSubjectRow(values)).toEqual({
      name: 'Noah',
      birthdate: null,
      color: 'orange',
    })
    expect(
      toSubjectForm({ name: 'Noah', birthdate: null, color: 'orange' }),
    ).toEqual({ name: 'Noah', birthdate: '', color: 'orange' })
  })
})

describe('nextSubjectColor', () => {
  it('starts with the first palette colour', () => {
    expect(nextSubjectColor([])).toBe('blue')
  })

  it('picks the least used colour, earliest in the palette on a tie', () => {
    expect(nextSubjectColor(['blue', 'orange'])).toBe('aqua')
    expect(nextSubjectColor(['blue', 'blue', 'orange'])).toBe('aqua')
    const allOnce = [
      'blue',
      'orange',
      'aqua',
      'yellow',
      'magenta',
      'green',
      'violet',
      'red',
    ] as const
    expect(nextSubjectColor([...allOnce])).toBe('blue')
    expect(nextSubjectColor([...allOnce, 'blue'])).toBe('orange')
  })
})

describe('formatAge', () => {
  const on = (date: string) => new Date(`${date}T12:00:00`)

  it('counts months for the first two years', () => {
    expect(formatAge('2026-11-01', on(today))).toBe('under 1 month')
    expect(formatAge('2026-10-09', on(today))).toBe('1 month')
    expect(formatAge('2024-11-10', on(today))).toBe('23 months')
  })

  it('then counts whole years', () => {
    expect(formatAge('2024-11-09', on(today))).toBe('2 years')
    expect(formatAge('2019-11-10', on(today))).toBe('6 years')
    expect(formatAge('2019-11-09', on(today))).toBe('7 years')
  })
})

describe('todayIso', () => {
  it("uses the viewer's calendar day", () => {
    expect(todayIso(new Date(2027, 0, 5, 23, 30))).toBe('2027-01-05')
  })
})

describe('initials', () => {
  it('takes the first letters of the first two words', () => {
    expect(initials('Mia Rose')).toBe('MR')
    expect(initials('Noah')).toBe('NO')
    expect(initials('Biscuit (dog)')).toBe('BD')
    expect(initials('élodie')).toBe('ÉL')
  })
})
