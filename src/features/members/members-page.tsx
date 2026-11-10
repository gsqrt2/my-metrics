import { Crown, Download, LogOut, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { NativeSelect } from '@/components/native-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/use-auth'
import { useExportCsv } from '@/features/export/use-export'
import { roleLabels } from '@/features/groups/format'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import {
  useChangeRole,
  useLeaveGroup,
  useMembers,
  useRemoveMember,
  useTransferOwnership,
  type Member,
} from '@/features/members/use-members'
import { useSubjects } from '@/features/subjects/use-subjects'

// FR-23, FR-24: who is in the group, and for the owner, managing them; for
// everyone else, leaving.
export function MembersPage() {
  return <WithGroup>{(group) => <Members group={group} />}</WithGroup>
}

function Members({ group }: { group: GroupRow }) {
  const { session } = useAuth()
  const me = session?.user.id
  const members = useMembers(group.id)
  const isOwner = group.role === 'owner'

  return (
    <>
      <BackLink to={`/logbooks/${group.id}`}>{group.name}</BackLink>
      <PageHeader
        title="Members"
        description={`Who can open ${group.name}. Members are separate from participants: someone can watch without being measured, and a child can be measured without an account.`}
        actions={
          canEditGroup(group) && (
            <Button asChild variant="outline">
              <Link to={`/logbooks/${group.id}/invites`}>Invite people</Link>
            </Button>
          )
        }
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {members.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              The members couldn't be loaded. Please reload the page.
            </AlertDescription>
          </Alert>
        )}
        {members.data && (
          <ul
            aria-label="Members"
            className="divide-y rounded-xl border bg-card"
          >
            {members.data.map((member) => (
              <MemberItem
                key={member.user_id}
                group={group}
                member={member}
                isMe={member.user_id === me}
                canManage={isOwner && member.role !== 'owner'}
              />
            ))}
          </ul>
        )}

        <Separator />

        {isOwner ? (
          <p className="text-sm text-muted-foreground">
            {group.isDefault
              ? "This is your Personal logbook, so it stays yours: it can't be handed over or left."
              : "As the owner you can't leave. To leave, make another member the owner first; you then stay as an editor."}
          </p>
        ) : (
          <LeaveSection group={group} />
        )}
      </div>
    </>
  )
}

function MemberItem({
  group,
  member,
  isMe,
  canManage,
}: {
  group: GroupRow
  member: Member
  isMe: boolean
  canManage: boolean
}) {
  const changeRole = useChangeRole(group.id)
  const remove = useRemoveMember(group.id)
  const transfer = useTransferOwnership(group.id)
  const [confirming, setConfirming] = useState<'remove' | 'owner' | null>(null)
  const name = member.profile?.display_name ?? 'A member'
  const failed = changeRole.isError || remove.isError || transfer.isError

  return (
    <li className="flex flex-col gap-3 px-4 py-3">
      {/* The name, then (for the owner) the controls, which wrap below the
          name on narrow screens instead of squeezing it. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-48 flex-1 flex-wrap items-center gap-2">
          <span className="font-medium break-words">{name}</span>
          {isMe && <span className="text-sm text-muted-foreground">(you)</span>}
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <NativeSelect
              aria-label={`Role of ${name}`}
              className="h-8 w-auto"
              value={member.role}
              disabled={changeRole.isPending}
              onChange={(event) =>
                changeRole.mutate(
                  {
                    userId: member.user_id,
                    role: event.target.value as 'editor' | 'viewer',
                  },
                  {
                    onSuccess: (_, { role }) =>
                      toast.success(
                        `Saved. ${name} is now ${role === 'editor' ? 'an editor' : 'a viewer'}.`,
                      ),
                  },
                )
              }
            >
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </NativeSelect>
            {!group.isDefault && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirming('owner')}
              >
                <Crown aria-hidden />
                Make owner
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setConfirming('remove')}
            >
              <UserMinus aria-hidden />
              Remove
            </Button>
          </div>
        ) : (
          <Badge variant="outline">{roleLabels[member.role]}</Badge>
        )}
      </div>

      {failed && (
        <Alert variant="destructive">
          <AlertDescription>
            That didn't work. Please try again.
          </AlertDescription>
        </Alert>
      )}

      {confirming === 'remove' && (
        <Confirm
          label={`Confirm removing ${name}`}
          text={`Remove ${name} from ${group.name}? Their entries stay in the logbook, under their participant, which nobody can link to again.`}
          action="Remove"
          destructive
          pending={remove.isPending}
          onConfirm={() =>
            remove.mutate(member.user_id, {
              onSuccess: () => setConfirming(null),
            })
          }
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'owner' && (
        <Confirm
          label={`Confirm making ${name} the owner`}
          text={`Make ${name} the owner of ${group.name}? You become an editor, and only ${name} can then manage members, delete the logbook or hand it back.`}
          action={`Make ${name} owner`}
          pending={transfer.isPending}
          onConfirm={() =>
            transfer.mutate(member.user_id, {
              onSuccess: () => setConfirming(null),
            })
          }
          onCancel={() => setConfirming(null)}
        />
      )}
    </li>
  )
}

function Confirm({
  label,
  text,
  action,
  destructive = false,
  pending,
  onConfirm,
  onCancel,
}: {
  label: string
  text: string
  action: string
  destructive?: boolean
  pending: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <p className="text-sm">{text}</p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={pending}
          onClick={onConfirm}
        >
          {action}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

// FR-23: leaving, with the choice of what happens to one's entries and the
// offer to export them first (FR-70).
function LeaveSection({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const subjects = useSubjects(group.id)
  const leave = useLeaveGroup(group.id, () => navigate('/logbooks'))
  const exportCsv = useExportCsv(group)
  const [keep, setKeep] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const mine = subjects.data?.find((s) => s.linked_user_id === session?.user.id)

  return (
    <section aria-labelledby="leave-heading" className="flex flex-col gap-3">
      <h2 id="leave-heading" className="font-heading font-semibold">
        Leave {group.name}
      </h2>
      {mine ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm">
            What happens to your participant “{mine.name}” and its entries?
          </legend>
          {[
            {
              value: true,
              label: 'Keep them in the logbook',
              hint: 'The others keep seeing your history; it no longer belongs to your account.',
            },
            {
              value: false,
              label: 'Delete them',
              hint: 'Your participant and everything logged for it are removed for good.',
            },
          ].map((option) => (
            <label
              key={String(option.value)}
              className="flex items-start gap-3 rounded-lg border px-3 py-2.5 has-checked:border-foreground"
            >
              <input
                type="radio"
                name="leave-keep"
                checked={keep === option.value}
                onChange={() => setKeep(option.value)}
                className="mt-1 accent-foreground"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-sm text-muted-foreground">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : (
        <p className="text-sm text-muted-foreground">
          You don't have a participant here, so nothing of yours is left behind.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>Want a copy of the entries first?</span>
        <Button
          variant="outline"
          size="sm"
          disabled={exportCsv.isPending}
          onClick={() => exportCsv.mutate()}
        >
          <Download aria-hidden />
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>
      {leave.isError && (
        <Alert variant="destructive">
          <AlertDescription>Leaving failed. Please try again.</AlertDescription>
        </Alert>
      )}
      {confirming ? (
        <Confirm
          label="Confirm leaving"
          text={`Leave ${group.name}? You'll need a new invite to come back.${mine && !keep ? ' Your entries are deleted for good.' : ''}`}
          action="Leave"
          destructive
          pending={leave.isPending}
          onConfirm={() => leave.mutate(mine ? keep : true)}
          onCancel={() => setConfirming(false)}
        />
      ) : (
        <Button
          variant="outline"
          className="self-start text-destructive"
          onClick={() => setConfirming(true)}
        >
          <LogOut aria-hidden />
          Leave logbook…
        </Button>
      )}
    </section>
  )
}
