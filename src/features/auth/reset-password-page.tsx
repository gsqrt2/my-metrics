import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router'

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
  MIN_PASSWORD_LENGTH,
  newPasswordSchema,
  type NewPasswordValues,
} from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/use-auth'
import { supabase } from '@/lib/supabase'

type LinkState = 'verifying' | 'valid' | 'invalid'

// Reached from the link in the password reset email (see
// supabase/templates/recovery.html): /reset-password?token_hash=…&type=recovery
export function ResetPasswordPage() {
  const { status, session } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const [linkState, setLinkState] = useState<LinkState>('verifying')
  const verifyStarted = useRef(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading' || verifyStarted.current) return
    verifyStarted.current = true

    if (!tokenHash) {
      // No token: only valid if the link was already verified in this
      // session (e.g. after a reload).
      setLinkState(session ? 'valid' : 'invalid')
      return
    }

    // The token works once, so verify it only once (Strict Mode runs effects twice).
    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      .then(({ error }) => {
        setLinkState(error ? 'invalid' : 'valid')
        setSearchParams({}, { replace: true })
      })
  }, [status, session, tokenHash, setSearchParams])

  const form = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirm: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ password }) => {
    setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(
        error.code === 'same_password'
          ? 'Choose a password that differs from your current one.'
          : error.code === 'weak_password'
            ? `Use at least ${MIN_PASSWORD_LENGTH} characters.`
            : 'Saving the password failed. Please try again.',
      )
      return
    }
    setDone(true)
  })

  if (linkState === 'verifying') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Checking your link…</h1>
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (linkState === 'invalid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>This link doesn't work</h1>
          </CardTitle>
          <CardDescription>
            Reset links work once and expire after an hour. Request a new one to
            choose a new password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Password changed</h1>
          </CardTitle>
          <CardDescription>
            Your new password is saved and you're logged in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link to="/logbooks">Continue to your logbooks</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Choose a new password</h1>
        </CardTitle>
        <CardDescription>
          Use at least {MIN_PASSWORD_LENGTH} characters.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField
            id="password"
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...form.register('password')}
          />
          <FormField
            id="confirm"
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...form.register('confirm')}
          />
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
