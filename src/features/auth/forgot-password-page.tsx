import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from '@/features/auth/schemas'
import { supabase } from '@/lib/supabase'

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    // Answer the same way whether or not the account exists, so the form
    // can't be used to find out who has an account.
    if (error?.status === 429) {
      setError('Too many requests. Please wait a moment and try again.')
      return
    }
    setSentTo(email)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Reset your password</h1>
        </CardTitle>
        <CardDescription>
          {sentTo
            ? `If an account exists for ${sentTo}, we've sent it a link to choose a new password. The link expires after an hour.`
            : "Enter your account's email address and we'll send you a link to choose a new password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!sentTo && (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <FormField
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...form.register('email')}
            />
            <Button type="submit" size="lg" disabled={isSubmitting}>
              {isSubmitting ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}
        <Link
          to="/login"
          className="self-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Back to log in
        </Link>
      </CardContent>
    </Card>
  )
}
