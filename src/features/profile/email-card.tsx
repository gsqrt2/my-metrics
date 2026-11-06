import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
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
import {
  emailChangeSchema,
  type EmailChangeValues,
} from '@/features/profile/schemas'
import { supabase } from '@/lib/supabase'

// FR-2: the change only takes effect once the new address confirms it by
// clicking the emailed link (see confirm-email-page.tsx).
export function EmailCard({
  email,
  pendingEmail,
}: {
  email: string
  pendingEmail?: string
}) {
  const [error, setError] = useState<string | null>(null)
  const schema = useMemo(() => emailChangeSchema(email), [email])
  const form = useForm<EmailChangeValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async ({ email: newEmail }) => {
    setError(null)
    // The session update (USER_UPDATED) brings the pending address to the page.
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    if (error) {
      setError(
        error.code === 'email_exists'
          ? 'This email address already belongs to another account.'
          : error.status === 429
            ? 'Too many requests. Please wait a moment and try again.'
            : 'Changing the email address failed. Please try again.',
      )
      return
    }
    form.reset()
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Email address</h2>
        </CardTitle>
        <CardDescription>
          You log in with <span className="text-foreground">{email}</span>.
          Password reset emails go here too.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pendingEmail && (
          <Alert>
            <AlertDescription>
              We've sent a confirmation link to{' '}
              <strong className="text-foreground">{pendingEmail}</strong>. Your
              address changes once you click it. Until then, keep logging in
              with {email}.
            </AlertDescription>
          </Alert>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <FormField
            id="new-email"
            label="New email address"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...form.register('email')}
          />
          <Button type="submit" className="self-start" disabled={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send confirmation link'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
