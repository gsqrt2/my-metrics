import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { supabase } from '@/lib/supabase'

type Result =
  | { state: 'verifying' }
  | { state: 'changed'; email: string }
  | { state: 'invalid' }

// Reached from the link in the email-change email (see
// supabase/templates/email_change.html): /confirm-email?token_hash=…&type=email_change
export function ConfirmEmailPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tokenHash = searchParams.get('token_hash')
  const [result, setResult] = useState<Result>(
    tokenHash ? { state: 'verifying' } : { state: 'invalid' },
  )
  const verifyStarted = useRef(false)

  useEffect(() => {
    // The token works once, so verify it only once (Strict Mode runs effects twice).
    if (!tokenHash || verifyStarted.current) return
    verifyStarted.current = true

    supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: 'email_change' })
      .then(({ data, error }) => {
        setResult(
          error || !data.user?.email
            ? { state: 'invalid' }
            : { state: 'changed', email: data.user.email },
        )
        setSearchParams({}, { replace: true })
      })
  }, [tokenHash, setSearchParams])

  if (result.state === 'verifying') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Confirming your email address…</h1>
          </CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (result.state === 'invalid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>This link doesn't work</h1>
          </CardTitle>
          <CardDescription>
            Confirmation links work once and expire after an hour. To try again,
            enter the new address on your profile page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full">
            <Link to="/profile">Go to your profile</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Email address changed</h1>
        </CardTitle>
        <CardDescription>
          From now on, you log in with{' '}
          <strong className="text-foreground">{result.email}</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild size="lg" className="w-full">
          <Link to="/groups">Continue to your groups</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
