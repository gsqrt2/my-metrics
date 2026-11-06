import { describe, expect, it } from 'vitest'

import {
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
} from '@/features/auth/schemas'

function firstError(result: {
  success: boolean
  error?: { issues: { message: string }[] }
}) {
  return result.error?.issues[0]?.message
}

describe('loginSchema', () => {
  it('accepts an email and password and trims the email', () => {
    const result = loginSchema.safeParse({
      email: '  alex@example.com ',
      password: 'password',
    })
    expect(result.success).toBe(true)
    expect(result.data?.email).toBe('alex@example.com')
  })

  it('asks for a missing email before checking its format', () => {
    expect(
      firstError(loginSchema.safeParse({ email: '', password: 'x' })),
    ).toBe('Enter your email address.')
  })

  it('rejects an invalid email', () => {
    expect(
      firstError(loginSchema.safeParse({ email: 'alex', password: 'x' })),
    ).toBe('Enter a valid email address.')
  })

  it('requires a password', () => {
    expect(
      firstError(
        loginSchema.safeParse({ email: 'alex@example.com', password: '' }),
      ),
    ).toBe('Enter your password.')
  })
})

describe('forgotPasswordSchema', () => {
  it('only needs a valid email', () => {
    expect(
      forgotPasswordSchema.safeParse({ email: 'kim@example.com' }).success,
    ).toBe(true)
  })
})

describe('newPasswordSchema', () => {
  it('accepts matching passwords of at least 8 characters', () => {
    expect(
      newPasswordSchema.safeParse({ password: '12345678', confirm: '12345678' })
        .success,
    ).toBe(true)
  })

  it('rejects passwords shorter than 8 characters', () => {
    expect(
      firstError(
        newPasswordSchema.safeParse({
          password: '1234567',
          confirm: '1234567',
        }),
      ),
    ).toBe('Use at least 8 characters.')
  })

  it('reports a mismatch on the confirmation field', () => {
    const result = newPasswordSchema.safeParse({
      password: '12345678',
      confirm: '12345679',
    })
    expect(result.error?.issues[0]?.path).toEqual(['confirm'])
    expect(firstError(result)).toBe("The passwords don't match.")
  })
})
