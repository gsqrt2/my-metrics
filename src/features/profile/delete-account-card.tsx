import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

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
import { useGroups } from '@/features/groups/use-groups'
import { supabase } from '@/lib/supabase'

type Blocking = { id: string; name: string }

// FR-3: deleting the account. Not while the user owns other logbooks: each
// is listed with where to hand it over or delete it.
export function DeleteAccountCard() {
  const groups = useGroups()
  const [confirming, setConfirming] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  // From the server, in case the list here was out of date.
  const [serverBlocking, setServerBlocking] = useState<Blocking[] | null>(null)

  const owned: Blocking[] =
    serverBlocking ??
    groups.data
      ?.filter((g) => g.role === 'owner' && !g.isDefault)
      .map(({ id, name }) => ({ id, name })) ??
    []

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault()
    if (!password) {
      setError('Enter your password.')
      return
    }
    setError(null)
    setPending(true)
    const { error: failed } = await supabase.functions.invoke(
      'delete-account',
      { body: { password } },
    )
    if (failed) {
      const body = await (failed as { context?: Response }).context
        ?.json()
        .catch(() => null)
      setPending(false)
      if (body?.error === 'wrong_password') {
        setError("That's not your password.")
      } else if (body?.error === 'owns_groups') {
        setServerBlocking(body.groups as Blocking[])
        setConfirming(false)
      } else {
        setError('Deleting your account failed. Please try again.')
      }
      return
    }
    // The account is gone, so only this device's session is left to clear;
    // logging out sends the app to the login page.
    toast.success('Your account was deleted.')
    await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Delete account</h2>
        </CardTitle>
        <CardDescription>
          Your personal logbook and the participants that are you, with their
          entries, are deleted for good. Entries you logged for others stay,
          without your name.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {groups.data && owned.length > 0 ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              First hand over or delete the{' '}
              {owned.length === 1 ? 'logbook' : 'logbooks'} you own:
            </p>
            <ul aria-label="Logbooks you own" className="flex flex-col gap-2">
              {owned.map((group) => (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2"
                >
                  <span className="min-w-0 flex-1 font-medium break-words">
                    {group.name}
                  </span>
                  <Link
                    to={`/logbooks/${group.id}/members`}
                    className="underline underline-offset-4"
                  >
                    Make someone else the owner
                  </Link>
                  <Link
                    to={`/logbooks/${group.id}/edit`}
                    className="underline underline-offset-4"
                  >
                    Delete it
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : confirming ? (
          <form
            noValidate
            onSubmit={deleteAccount}
            role="group"
            aria-label="Confirm deleting your account"
            className="flex flex-col gap-4 rounded-lg border p-3"
          >
            <p className="text-sm">
              Delete your account for good? This can't be undone.
            </p>
            <FormField
              id="delete-account-password"
              label="Your password"
              type="password"
              autoComplete="current-password"
              value={password}
              error={error ?? undefined}
              onChange={(event) => setPassword(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? 'Deleting…' : 'Delete my account'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setConfirming(false)
                  setPassword('')
                  setError(null)
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <Button
            variant="outline"
            className="self-start text-destructive"
            disabled={!groups.data}
            onClick={() => setConfirming(true)}
          >
            <Trash2 aria-hidden />
            Delete account…
          </Button>
        )}
        {groups.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              Your logbooks couldn't be loaded. Please reload the page.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
