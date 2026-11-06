import { describe, expect, it } from 'vitest'

import {
  displayNameSchema,
  emailChangeSchema,
  passwordChangeSchema,
} from '@/features/profile/schemas'

function firstError(result: {
  error?: { issues: { message: string; path: PropertyKey[] }[] }
}) {
  return result.error?.issues[0]
}

describe('displayNameSchema', () => {
  it('trims the name', () => {
    expect(
      displayNameSchema.parse({ displayName: '  Alex  ' }).displayName,
    ).toBe('Alex')
  })

  it('rejects a name of only spaces', () => {
    expect(
      firstError(displayNameSchema.safeParse({ displayName: '   ' }))?.message,
    ).toBe('Enter a display name.')
  })

  it('allows 80 characters but not 81', () => {
    expect(
      displayNameSchema.safeParse({ displayName: 'x'.repeat(80) }).success,
    ).toBe(true)
    expect(
      firstError(displayNameSchema.safeParse({ displayName: 'x'.repeat(81) }))
        ?.message,
    ).toBe('Use at most 80 characters.')
  })
})

describe('emailChangeSchema', () => {
  const schema = emailChangeSchema('alex@example.com')

  it('accepts a different valid address', () => {
    expect(schema.safeParse({ email: 'alex@new.example' }).success).toBe(true)
  })

  it('rejects the current address, ignoring case', () => {
    expect(
      firstError(schema.safeParse({ email: 'Alex@Example.com' }))?.message,
    ).toBe('This is already your email address.')
  })

  it('rejects an invalid address', () => {
    expect(firstError(schema.safeParse({ email: 'alex' }))?.message).toBe(
      'Enter a valid email address.',
    )
  })
})

describe('passwordChangeSchema', () => {
  const valid = {
    current: 'password',
    password: 'new-password',
    confirm: 'new-password',
  }

  it('accepts a current password and a matching new one', () => {
    expect(passwordChangeSchema.safeParse(valid).success).toBe(true)
  })

  it('requires the current password', () => {
    expect(
      firstError(passwordChangeSchema.safeParse({ ...valid, current: '' }))
        ?.message,
    ).toBe('Enter your current password.')
  })

  it('reports a mismatch on the confirmation field', () => {
    const issue = firstError(
      passwordChangeSchema.safeParse({ ...valid, confirm: 'other-password' }),
    )
    expect(issue?.path).toEqual(['confirm'])
    expect(issue?.message).toBe("The passwords don't match.")
  })
})
