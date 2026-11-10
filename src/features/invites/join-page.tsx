import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { FormField } from '@/components/form-field'
import { NativeSelect } from '@/components/native-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { MIN_PASSWORD_LENGTH } from '@/features/auth/schemas'
import type { LoginLocationState } from '@/features/auth/require-auth'
import { useAuth } from '@/features/auth/use-auth'
import { roleLabels } from '@/features/groups/format'
import {
  joinErrorMessage,
  useAcceptInvite,
  useInvitePreview,
  useRedeemInvite,
  type InvitePreview,
  type JoinChoice,
} from '@/features/invites/use-invites'
import { useProfile } from '@/features/profile/use-profile'
import { formatDate } from '@/lib/dates'
import { supabase } from '@/lib/supabase'

const unavailable: Record<string, string> = {
  invalid:
    "This link doesn't lead to an invite. Check that it was copied completely.",
  expired: 'This invite has expired. Ask whoever invited you for a new link.',
  revoked: 'This invite was withdrawn. Ask whoever invited you for a new link.',
  used: 'This invite has already been used.',
}

// FR-20 – FR-22: where an invite link leads, for visitors with and without
// an account.
export function JoinPage() {
  const { token } = useParams()
  const { status, session } = useAuth()
  const preview = useInvitePreview(token!)

  if (status === 'loading' || preview.isPending) return null
  if (preview.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          The invite couldn't be loaded. Please reload the page.
        </AlertDescription>
      </Alert>
    )
  }
  const invite = preview.data
  if (invite.status !== 'valid') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>Invite not available</h1>
          </CardTitle>
          <CardDescription>{unavailable[invite.status]}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link to={session ? '/logbooks' : '/login'}>
              {session ? 'Go to your logbooks' : 'Log in'}
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Join {invite.group_name}</h1>
        </CardTitle>
        <CardDescription>
          {invite.inviter_name ?? 'A member'} invited you as{' '}
          {invite.role === 'editor' ? 'an editor' : 'a viewer'}:{' '}
          {invite.role === 'editor'
            ? 'you can log, and manage participants and metrics.'
            : 'you can see everything, and log for yourself.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {session ? (
          <JoinSignedIn token={token!} invite={invite} />
        ) : (
          <JoinNew token={token!} invite={invite} />
        )}
      </CardContent>
    </Card>
  )
}

// How the joiner takes part (FR-22): track themselves (the default), ask to
// be an existing participant without an account, or just watch.
function ChoiceFields({
  invite,
  choice,
  onChoice,
  subjectId,
  onSubject,
}: {
  invite: InvitePreview
  choice: JoinChoice
  onChoice: (choice: JoinChoice) => void
  subjectId: string
  onSubject: (id: string) => void
}) {
  const options: { value: JoinChoice; label: string; hint: string }[] = [
    {
      value: 'new',
      label: 'Track myself here',
      hint: "You're added as a participant, under your name.",
    },
    ...(invite.subjects.length > 0
      ? [
          {
            value: 'request' as const,
            label: "I'm already tracked here",
            hint: "Choose who you are; the logbook's owner confirms it.",
          },
        ]
      : []),
    {
      value: 'none',
      label: 'Just watch',
      hint: 'No participant for you, e.g. to follow the children.',
    },
  ]
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm leading-none font-medium">
        How do you take part?
      </legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex items-start gap-3 rounded-lg border px-3 py-2.5 has-checked:border-foreground has-focus-visible:outline-3 has-focus-visible:outline-ring/50"
        >
          <input
            type="radio"
            name="join-choice"
            value={option.value}
            checked={choice === option.value}
            onChange={() => onChoice(option.value)}
            className="mt-1 accent-foreground"
          />
          <span className="flex flex-col">
            <span className="text-sm font-medium">{option.label}</span>
            <span className="text-sm text-muted-foreground">{option.hint}</span>
          </span>
        </label>
      ))}
      {choice === 'request' && (
        <div className="mt-2 flex flex-col gap-2">
          <Label htmlFor="join-subject">Who are you?</Label>
          <NativeSelect
            id="join-subject"
            value={subjectId}
            onChange={(event) => onSubject(event.target.value)}
          >
            {invite.subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
    </fieldset>
  )
}

function useChoice(invite: InvitePreview) {
  const [choice, setChoice] = useState<JoinChoice>('new')
  const [subjectId, setSubjectId] = useState(invite.subjects[0]?.id ?? '')
  return {
    choice,
    setChoice,
    subjectId,
    setSubjectId,
    payload: {
      choice,
      subjectId: choice === 'request' ? subjectId : undefined,
    },
  }
}

function JoinSignedIn({
  token,
  invite,
}: {
  token: string
  invite: InvitePreview
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const profile = useProfile()
  const accept = useAcceptInvite(token)
  const choice = useChoice(invite)

  // An email invite works only for its address (FR-20).
  const email = session?.user.email ?? ''
  if (
    invite.invite_email &&
    invite.invite_email.toLowerCase() !== email.toLowerCase()
  ) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">
          This invite is for{' '}
          <span className="font-medium">{invite.invite_email}</span>, but you're
          logged in as <span className="font-medium">{email}</span>. Log out,
          then open the link again to join with that address.
        </p>
        <Button
          variant="outline"
          className="self-start"
          onClick={() => supabase.auth.signOut()}
        >
          Log out
        </Button>
      </div>
    )
  }

  if (invite.already_member) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm">You're already a member of this logbook.</p>
        <Button asChild className="self-start">
          <Link to={`/logbooks/${invite.group_id}`}>
            Open {invite.group_name}
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        accept.mutate(choice.payload, {
          onSuccess: (groupId) => navigate(`/logbooks/${groupId}`),
        })
      }}
    >
      <p className="text-sm">
        Joining as{' '}
        <span className="font-medium">
          {profile.data?.display_name ?? session?.user.email}
        </span>{' '}
        ({session?.user.email}).{' '}
        <button
          type="button"
          className="font-medium underline underline-offset-4"
          onClick={() => supabase.auth.signOut()}
        >
          Not you? Log out
        </button>
      </p>
      <ChoiceFields
        invite={invite}
        choice={choice.choice}
        onChoice={choice.setChoice}
        subjectId={choice.subjectId}
        onSubject={choice.setSubjectId}
      />
      {accept.isError && (
        <Alert variant="destructive">
          <AlertDescription>{joinErrorMessage(accept.error)}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" disabled={accept.isPending}>
        {accept.isPending ? 'Joining…' : `Join ${invite.group_name}`}
      </Button>
    </form>
  )
}

function JoinNew({ token, invite }: { token: string; invite: InvitePreview }) {
  const navigate = useNavigate()
  const redeem = useRedeemInvite(token)
  const choice = useChoice(invite)
  const [fields, setFields] = useState({
    displayName: '',
    email: invite.invite_email ?? '',
    password: '',
    confirm: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const login: LoginLocationState = { from: `/join/${token}` }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found: Record<string, string> = {}
    if (!fields.displayName.trim()) found.displayName = 'Enter your name.'
    else if (fields.displayName.trim().length > 80) {
      found.displayName = 'Use at most 80 characters.'
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      found.email = 'Enter a valid email address.'
    }
    if (fields.password.length < MIN_PASSWORD_LENGTH) {
      found.password = `Use at least ${MIN_PASSWORD_LENGTH} characters.`
    }
    if (fields.confirm !== fields.password) {
      found.confirm = "The passwords don't match."
    }
    setErrors(found)
    if (Object.keys(found).length > 0) return
    redeem.mutate(
      {
        displayName: fields.displayName.trim(),
        email: fields.email.trim(),
        password: fields.password,
        ...choice.payload,
      },
      { onSuccess: (groupId) => navigate(`/logbooks/${groupId}`) },
    )
  }

  const set =
    (key: keyof typeof fields) =>
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setFields((f) => ({ ...f, [key]: event.target.value }))

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Already have an account?{' '}
        <Link
          to="/login"
          state={login}
          className="font-medium underline underline-offset-4"
        >
          Log in to join
        </Link>
      </p>
      <form noValidate onSubmit={submit} className="flex flex-col gap-5">
        <h2 className="font-heading font-semibold">
          New here? Create your account
        </h2>
        <FormField
          id="join-name"
          label="Your name"
          autoComplete="name"
          maxLength={80}
          value={fields.displayName}
          error={errors.displayName}
          onChange={set('displayName')}
        />
        <FormField
          id="join-email"
          label="Email"
          type="email"
          autoComplete="email"
          value={fields.email}
          error={errors.email}
          onChange={set('email')}
          readOnly={!!invite.invite_email}
          aria-describedby={
            invite.invite_email && !errors.email ? 'join-email-hint' : undefined
          }
        />
        {invite.invite_email && (
          <p
            id="join-email-hint"
            className="-mt-3 text-sm text-muted-foreground"
          >
            The invite is for this address.
          </p>
        )}
        <FormField
          id="join-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={fields.password}
          error={errors.password}
          onChange={set('password')}
        />
        <FormField
          id="join-confirm"
          label="Repeat password"
          type="password"
          autoComplete="new-password"
          value={fields.confirm}
          error={errors.confirm}
          onChange={set('confirm')}
        />
        <ChoiceFields
          invite={invite}
          choice={choice.choice}
          onChoice={choice.setChoice}
          subjectId={choice.subjectId}
          onSubject={choice.setSubjectId}
        />
        {redeem.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              {joinErrorMessage(redeem.error)}
            </AlertDescription>
          </Alert>
        )}
        <Button type="submit" disabled={redeem.isPending}>
          {redeem.isPending
            ? 'Creating your account…'
            : `Create account and join`}
        </Button>
      </form>
      <p className="text-xs text-muted-foreground">
        {roleLabels[invite.role ?? 'viewer']} access. The invite expires{' '}
        {invite.expires_at ? formatDate(new Date(invite.expires_at)) : 'soon'}.
      </p>
    </div>
  )
}
