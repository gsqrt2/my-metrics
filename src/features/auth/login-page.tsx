import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'

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
import type { LoginLocationState } from '@/features/auth/require-auth'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { useAuth } from '@/features/auth/use-auth'
import { supabase } from '@/lib/supabase'

export function LoginPage() {
  const { status, session } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as LoginLocationState | null)?.from ?? '/logbooks'
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  if (status === 'ready' && session) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null)
    const { error } = await supabase.auth.signInWithPassword(values)
    if (error) {
      setError(
        error.code === 'invalid_credentials'
          ? 'Wrong email or password.'
          : 'Logging in failed. Please try again.',
      )
      return
    }
    navigate(from, { replace: true })
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Log in</h1>
        </CardTitle>
        <CardDescription>
          my-metrics is invite-only. To get an account, ask a member to invite
          you to a group.
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
            id="email"
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register('email')}
          />
          <div className="flex flex-col gap-2">
            <FormField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...form.register('password')}
            />
            <Link
              to="/forgot-password"
              className="self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
