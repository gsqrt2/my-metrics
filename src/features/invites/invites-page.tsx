import { Check, Copy, Link2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { NativeSelect } from '@/components/native-select'
import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/use-auth'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import {
  inviteLink,
  useCreateInvite,
  useDecideLinkRequest,
  useOpenInvites,
  usePendingLinkRequests,
  useRevokeInvite,
  type InviteRole,
} from '@/features/invites/use-invites'
import { formatDate } from '@/lib/dates'

const roles: { value: InviteRole; label: string }[] = [
  { value: 'viewer', label: 'Viewer' },
  { value: 'editor', label: 'Editor' },
]
const roleHints: Record<InviteRole, string> = {
  viewer: 'Sees everything, and logs for themselves.',
  editor: 'Also logs for others and manages participants and metrics.',
}
const durations = [
  { days: 1, label: '1 day' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
]

// FR-20 – FR-22: invite links for owners and editors, and for the owner the
// requests to be linked to a participant.
export function InvitesPage() {
  return <WithGroup>{(group) => <Invites group={group} />}</WithGroup>
}

function Invites({ group }: { group: GroupRow }) {
  const groupPath = `/logbooks/${group.id}`
  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Invite people"
          description="Only the logbook's owner and editors can invite people."
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      {back}
      <PageHeader
        title="Invite people"
        description={`Share a link to ${group.name} through any channel. Whoever opens it can join until it expires or you withdraw it.`}
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {group.role === 'owner' && <LinkRequests group={group} />}
        <NewInvite group={group} />
        <Separator />
        <OpenInvites group={group} />
      </div>
    </>
  )
}

function NewInvite({ group }: { group: GroupRow }) {
  const create = useCreateInvite(group.id)
  const [role, setRole] = useState<InviteRole>('viewer')
  const [days, setDays] = useState(7)
  const [token, setToken] = useState<string | null>(null)

  return (
    <section
      aria-labelledby="new-invite-heading"
      className="flex flex-col gap-4"
    >
      <h2 id="new-invite-heading" className="font-heading font-semibold">
        New invite link
      </h2>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Joins as</span>
        <Segmented
          label="Joins as"
          options={roles}
          value={role}
          onChange={setRole}
        />
        <p className="text-sm text-muted-foreground">{roleHints[role]}</p>
      </div>
      <div className="flex max-w-48 flex-col gap-2">
        <Label htmlFor="invite-days">Valid for</Label>
        <NativeSelect
          id="invite-days"
          value={String(days)}
          onChange={(event) => setDays(Number(event.target.value))}
        >
          {durations.map((d) => (
            <option key={d.days} value={d.days}>
              {d.label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {create.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            The link couldn't be created. Please try again.
          </AlertDescription>
        </Alert>
      )}
      <Button
        className="self-start"
        disabled={create.isPending}
        onClick={() =>
          create.mutate({ role, days }, { onSuccess: (t) => setToken(t) })
        }
      >
        <Link2 aria-hidden />
        {create.isPending ? 'Creating…' : 'Create link'}
      </Button>
      {token && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/40 p-3">
          <Label htmlFor="new-invite-link">Your new link</Label>
          <div className="flex gap-2">
            <Input id="new-invite-link" readOnly value={inviteLink(token)} />
            <CopyButton text={inviteLink(token)} />
          </div>
          <p className="text-sm text-muted-foreground">
            Send it however you like: a message, an email, a chat.
          </p>
        </div>
      )}
    </section>
  )
}

function OpenInvites({ group }: { group: GroupRow }) {
  const { session } = useAuth()
  const invites = useOpenInvites(group.id)
  const revoke = useRevokeInvite(group.id)

  return (
    <section
      aria-labelledby="open-invites-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="open-invites-heading" className="font-heading font-semibold">
        Open invites
      </h2>
      {invites.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            The invites couldn't be loaded. Please reload the page.
          </AlertDescription>
        </Alert>
      )}
      {invites.data && invites.data.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {group.role === 'owner'
            ? 'No open invites.'
            : 'No open invites from you.'}
        </p>
      )}
      {invites.data && invites.data.length > 0 && (
        <ul
          aria-label="Open invites"
          className="divide-y rounded-xl border bg-card"
        >
          {invites.data.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
                <span className="font-medium">
                  {invite.role === 'editor' ? 'Editor' : 'Viewer'} link
                </span>
                <span className="text-muted-foreground">
                  Until {formatDate(new Date(invite.expires_at))}
                  {invite.created_by !== session?.user.id &&
                    ` · by ${invite.creator?.display_name ?? 'a former member'}`}
                </span>
              </div>
              <CopyButton text={inviteLink(invite.token)} label="Copy link" />
              <Button
                variant="ghost"
                size="sm"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(invite.id)}
              >
                Withdraw
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// FR-22: people who joined asking to be an existing participant.
function LinkRequests({ group }: { group: GroupRow }) {
  const requests = usePendingLinkRequests(group.id)
  const decide = useDecideLinkRequest(group.id)
  if (!requests.data || requests.data.length === 0) return null

  return (
    <section
      aria-labelledby="requests-heading"
      className="flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="requests-heading" className="font-heading font-semibold">
        Waiting for you
      </h2>
      {decide.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            That didn't work: the participant may no longer be available.
          </AlertDescription>
        </Alert>
      )}
      <ul aria-label="Link requests" className="flex flex-col gap-3">
        {requests.data.map((request) => (
          <li
            key={request.id}
            className="flex flex-wrap items-center justify-between gap-3 text-sm"
          >
            <span>
              <span className="font-medium">
                {request.requester.display_name}
              </span>{' '}
              says they're{' '}
              <span className="font-medium">{request.subject.name}</span>.
            </span>
            <span className="flex gap-2">
              <Button
                size="sm"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({ requestId: request.id, approve: true })
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={decide.isPending}
                onClick={() =>
                  decide.mutate({ requestId: request.id, approve: false })
                }
              >
                Reject
              </Button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// Copies text, with a fallback of selecting it when the clipboard refuses.
function CopyButton({
  text,
  label = 'Copy',
}: {
  text: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          window.prompt('Copy the link:', text)
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
