import { z } from 'zod'

import { emailField, newPasswordField } from '@/features/auth/schemas'

// Matches the check constraints on profiles.display_name (FR-80).
export const MAX_DISPLAY_NAME_LENGTH = 80

export const displayNameSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Enter a display name.')
    .max(
      MAX_DISPLAY_NAME_LENGTH,
      `Use at most ${MAX_DISPLAY_NAME_LENGTH} characters.`,
    ),
})

export function emailChangeSchema(currentEmail: string) {
  return z.object({
    email: emailField.refine(
      (email) => email.toLowerCase() !== currentEmail.toLowerCase(),
      'This is already your email address.',
    ),
  })
}

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, 'Enter your current password.'),
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "The passwords don't match.",
    path: ['confirm'],
  })

export type DisplayNameValues = z.infer<typeof displayNameSchema>
export type EmailChangeValues = z.infer<ReturnType<typeof emailChangeSchema>>
export type PasswordChangeValues = z.infer<typeof passwordChangeSchema>
