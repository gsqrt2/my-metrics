import { Archive, ArchiveRestore, Download, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { Confirm } from '@/components/confirm'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useExportCsv } from '@/features/export/use-export'
import type { GroupRow } from '@/features/groups/types'
import {
  useDeleteGroup,
  useSetGroupArchived,
} from '@/features/groups/use-groups'
import { formatDate } from '@/lib/dates'

// FR-11: archiving and deleting, for the owner, on the Edit logbook page.
// The default group is neither (FR-13).
export function ArchiveDeleteSection({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const archive = useSetGroupArchived(group.id)
  const [confirming, setConfirming] = useState(false)
  if (group.role !== 'owner') return null

  return (
    <section
      aria-labelledby="lifecycle-heading"
      className="flex max-w-xl flex-col gap-4"
    >
      <h2 id="lifecycle-heading" className="font-heading font-semibold">
        Archive or delete
      </h2>
      {group.isDefault ? (
        <p className="text-sm text-muted-foreground">
          Your personal logbook can't be archived or deleted: it stays as long
          as your account does.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              Archive a logbook that's finished, like a challenge that ended.
              Everyone keeps seeing it, but nothing can be logged or changed
              until you restore it.
            </p>
            {archive.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Archiving failed. Please try again.
                </AlertDescription>
              </Alert>
            )}
            {confirming ? (
              <Confirm
                label="Confirm archiving"
                text={`Archive ${group.name}? It becomes read-only for everyone, and open invites are withdrawn.`}
                action="Archive"
                pending={archive.isPending}
                onConfirm={() =>
                  archive.mutate(true, {
                    onSuccess: () => {
                      navigate(`/logbooks/${group.id}`)
                      toast.success(`Archived. ${group.name} is now read-only.`)
                    },
                  })
                }
                onCancel={() => setConfirming(false)}
              />
            ) : (
              <Button
                variant="outline"
                className="self-start"
                onClick={() => setConfirming(true)}
              >
                <Archive aria-hidden />
                Archive logbook…
              </Button>
            )}
          </div>
          <DeleteGroup group={group} />
        </>
      )}
    </section>
  )
}

// Shown on an archived group's page; the owner restores or deletes it here.
export function ArchivedNotice({ group }: { group: GroupRow }) {
  const restore = useSetGroupArchived(group.id)
  return (
    <section
      aria-label="Archived"
      className="mb-6 flex flex-col gap-3 rounded-xl border bg-muted/40 p-4"
    >
      <p className="flex items-start gap-2 text-sm">
        <Archive aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          Archived
          {group.archivedAt && ` on ${formatDate(new Date(group.archivedAt))}`}.
          It's read-only: nothing can be logged or changed
          {group.role === 'owner' ? ' until you restore it' : ''}.
        </span>
      </p>
      {group.role === 'owner' && (
        <div className="flex flex-col gap-3">
          {restore.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Restoring failed. Please try again.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              disabled={restore.isPending}
              onClick={() =>
                restore.mutate(false, {
                  onSuccess: () =>
                    toast.success(
                      `Restored. ${group.name} can be changed again.`,
                    ),
                })
              }
            >
              <ArchiveRestore aria-hidden />
              {restore.isPending ? 'Restoring…' : 'Restore'}
            </Button>
          </div>
          <DeleteGroup group={group} />
        </div>
      )}
    </section>
  )
}

// Deleting asks for the logbook's name: it's for everyone, and for good.
function DeleteGroup({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const remove = useDeleteGroup(group.id, () => {
    navigate('/logbooks')
    toast.success(`Deleted ${group.name}.`)
  })
  const exportCsv = useExportCsv(group)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')

  if (!confirming) {
    return (
      <Button
        variant="outline"
        className="self-start text-destructive"
        onClick={() => setConfirming(true)}
      >
        <Trash2 aria-hidden />
        Delete logbook…
      </Button>
    )
  }
  const others = group.memberCount - 1
  return (
    <Confirm
      label="Confirm deleting"
      text={`Delete ${group.name}${others > 0 ? ` for you and ${others === 1 ? '1 other member' : `${others} other members`}` : ''}? Its participants, metrics and entries are removed for good.`}
      action="Delete for good"
      destructive
      disabled={typed.trim() !== group.name.trim()}
      pending={remove.isPending}
      onConfirm={() => remove.mutate()}
      onCancel={() => {
        setConfirming(false)
        setTyped('')
      }}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted-foreground">
        <span>Want a copy first?</span>
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
      <div className="flex flex-col gap-2">
        <Label htmlFor="delete-confirm-name">
          Type the logbook's name to confirm
        </Label>
        <Input
          id="delete-confirm-name"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      </div>
      {remove.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Deleting failed. Please try again.
          </AlertDescription>
        </Alert>
      )}
    </Confirm>
  )
}
