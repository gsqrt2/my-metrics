import { z } from 'zod'

// Matches minimum_password_length in supabase/config.toml.
export const MIN_PASSWORD_LENGTH = 8

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .pipe(z.email('Enter a valid email address.'))

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password.'),
})

export const forgotPasswordSchema = z.object({ email: emailField })

export const newPasswordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`)

export const newPasswordSchema = z
  .object({
    password: newPasswordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    message: "The passwords don't match.",
    path: ['confirm'],
  })

export type LoginValues = z.infer<typeof loginSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type NewPasswordValues = z.infer<typeof newPasswordSchema>
