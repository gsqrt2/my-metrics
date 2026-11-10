import { describe, expect, it } from 'vitest'

import {
  emptyGroupForm,
  groupSchema,
  toGroupForm,
  toGroupRow,
  type GroupFormValues,
} from '@/features/groups/schemas'

function errors(values: Partial<GroupFormValues>) {
  const result = groupSchema.safeParse({ ...emptyGroupForm, ...values })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('group form', () => {
  it('needs a name that is more than spaces', () => {
    expect(errors({ name: '   ' })).toEqual({ name: 'Enter a name.' })
  })

  it('limits the name to 80 and the description to 500 characters', () => {
    expect(
      errors({ name: 'x'.repeat(81), description: 'x'.repeat(501) }),
    ).toEqual({
      name: 'Use at most 80 characters.',
      description: 'Use at most 500 characters.',
    })
    expect(
      errors({ name: 'x'.repeat(80), description: 'x'.repeat(500) }),
    ).toEqual({})
  })

  it('ignores the dates unless the group runs between two dates', () => {
    expect(errors({ name: 'Kids', startsOn: '2027-01-10' })).toEqual({})
  })

  it('needs both dates for a duration', () => {
    expect(errors({ name: 'Diet', hasDuration: true })).toEqual({
      startsOn: 'Choose a start date.',
      endsOn: 'Choose an end date.',
    })
  })

  it('refuses an end date before the start date, but allows one day', () => {
    expect(
      errors({
        name: 'Diet',
        hasDuration: true,
        startsOn: '2027-01-10',
        endsOn: '2027-01-09',
      }),
    ).toEqual({ endsOn: "The end date can't be before the start date." })
    expect(
      errors({
        name: 'Diet',
        hasDuration: true,
        startsOn: '2027-01-10',
        endsOn: '2027-01-10',
      }),
    ).toEqual({})
  })
})

describe('saving a group', () => {
  it('trims the text and saves an empty description as none', () => {
    const values = groupSchema.parse({
      ...emptyGroupForm,
      name: '  Kids ',
      description: '   ',
    })
    expect(toGroupRow(values)).toEqual({
      name: 'Kids',
      description: null,
      starts_on: null,
      ends_on: null,
    })
  })

  it('drops the dates when the duration is switched off', () => {
    const values = groupSchema.parse({
      ...emptyGroupForm,
      name: 'Diet',
      hasDuration: false,
      startsOn: '2027-01-04',
      endsOn: '2027-03-28',
    })
    expect(toGroupRow(values)).toMatchObject({
      starts_on: null,
      ends_on: null,
    })
  })

  it('fills the edit form from a saved group', () => {
    expect(
      toGroupForm({
        name: 'Diet',
        description: null,
        starts_on: '2027-01-04',
        ends_on: '2027-03-28',
      }),
    ).toEqual({
      ownSubjectOnly: false,
      name: 'Diet',
      description: '',
      hasDuration: true,
      startsOn: '2027-01-04',
      endsOn: '2027-03-28',
    })
  })
})
