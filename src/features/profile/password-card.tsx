import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

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
import { MIN_PASSWORD_LENGTH } from '@/features/auth/schemas'
import {
  passwordChangeSchema,
  type PasswordChangeValues,
} from '@/features/profile/schemas'
import { verifyPassword } from '@/features/profile/verify-password'
import { supabase } from '@/lib/supabase'

export function PasswordCard({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const form = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { current: '', password: '', confirm: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ current, password }) => {
    setError(null)
    setSaved(false)

    if (!(await verifyPassword(email, current))) {
      form.setError('current', {
        message: "That's not your current password.",
      })
      return
    }

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setError(
        error.code === 'same_password'
          ? 'Choose a password that differs from your current one.'
          : 'Saving the password failed. Please try again.',
      )
      return
    }
    form.reset()
    setSaved(true)
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Password</h2>
        </CardTitle>
        <CardDescription>
          Use at least {MIN_PASSWORD_LENGTH} characters. We'll email you when it
          changes.
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
            id="current-password"
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={errors.current?.message}
            {...form.register('current')}
          />
          <FormField
            id="new-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...form.register('password')}
          />
          <FormField
            id="confirm-password"
            label="Repeat new password"
            type="password"
            autoComplete="new-password"
            error={errors.confirm?.message}
            {...form.register('confirm')}
          />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Change password'}
            </Button>
            {saved && (
              <p role="status" className="text-sm text-muted-foreground">
                Password changed.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
