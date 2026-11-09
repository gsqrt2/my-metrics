import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { attributeLabel } from '@/features/attributes/format'
import { useAuth } from '@/features/auth/use-auth'
import {
  formatDateTime,
  fromLocalInputValue,
  toLocalInputValue,
} from '@/features/entries/datetime'
import { canLogFor } from '@/features/entries/permissions'
import {
  useDeleteEntry,
  useEntry,
  useUpdateEntry,
  type Entry,
} from '@/features/entries/use-entries'
import {
  commentError,
  entryErrorMessage,
  MAX_COMMENT_LENGTH,
  measuredAtError,
  valueError,
} from '@/features/entries/validation'
import { WithGroup } from '@/features/groups/group-page'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import { parseDecimal } from '@/lib/numbers'

// FR-52: edit or delete an entry. Its participant and metric stay as logged.
export function EditEntryPage() {
  return <WithGroup>{(group) => <FindEntry group={group} />}</WithGroup>
}

function FindEntry({ group }: { group: GroupRow }) {
  const { entryId } = useParams()
  const entry = useEntry(entryId!)
  const { session } = useAuth()
  const groupPath = `/logbooks/${group.id}`
  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (entry.isPending) return null
  const found =
    entry.data && entry.data.subject.group_id === group.id ? entry.data : null
  const editable =
    found !== null &&
    canLogFor(group, found.subject, session?.user.id) &&
    !found.attribute.archived_at

  if (!found || !editable) {
    return (
      <>
        {back}
        <PageHeader
          title={found ? 'Edit entry' : 'Entry not found'}
          description={
            found
              ? "You can't change entries for this participant or metric."
              : "It doesn't exist in this logbook, or it was deleted."
          }
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }
  return <EditEntry entry={found} groupPath={groupPath} back={back} />
}

function EditEntry({
  entry,
  groupPath,
  back,
}: {
  entry: Entry
  groupPath: string
  back: React.ReactNode
}) {
  const navigate = useNavigate()
  const update = useUpdateEntry(entry.id)
  const remove = useDeleteEntry(entry.id)
  const [value, setValue] = useState(String(entry.value))
  const [measuredAt, setMeasuredAt] = useState(() =>
    toLocalInputValue(new Date(entry.measured_at)),
  )
  const [comment, setComment] = useState(entry.comment ?? '')
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const done = { onSuccess: () => navigate(groupPath) }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = {
      value:
        value.trim() === ''
          ? 'Enter a value.'
          : // Limits only apply to changed values (FR-40).
            parseDecimal(value) === entry.value
            ? undefined
            : valueError(value, entry.attribute),
      measuredAt: measuredAtError(measuredAt),
      comment: commentError(comment),
    }
    setErrors(found)
    if (Object.values(found).some(Boolean)) return
    update.mutate(
      {
        value: parseDecimal(value)!,
        measured_at: fromLocalInputValue(measuredAt)!.toISOString(),
        comment: comment.trim() || null,
      },
      done,
    )
  }

  return (
    <>
      {back}
      <PageHeader
        title="Edit entry"
        description={`${entry.attribute.name} · ${entry.subject.name}`}
      />
      <div className="flex max-w-xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <SubjectAvatar
            name={entry.subject.name}
            color={entry.subject.color}
          />
          <div className="flex flex-col text-sm">
            <span className="font-medium">{entry.subject.name}</span>
            <span className="text-muted-foreground">
              {attributeLabel(entry.attribute)}
            </span>
          </div>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {update.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {entryErrorMessage(update.error)}
              </AlertDescription>
            </Alert>
          )}
          <FormField
            id="entry-value"
            label={attributeLabel(entry.attribute)}
            inputMode="decimal"
            autoComplete="off"
            value={value}
            error={errors.value}
            onChange={(event) => setValue(event.target.value)}
          />
          <FormField
            id="entry-measured-at"
            label="When"
            type="datetime-local"
            value={measuredAt}
            max={toLocalInputValue(new Date())}
            error={errors.measuredAt}
            onChange={(event) => setMeasuredAt(event.target.value)}
          />
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-comment">Comment (optional)</Label>
            <Textarea
              id="entry-comment"
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              value={comment}
              aria-invalid={errors.comment ? true : undefined}
              onChange={(event) => setComment(event.target.value)}
            />
            {errors.comment && (
              <p className="text-sm text-destructive">{errors.comment}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? 'Saving…' : 'Save changes'}
            </Button>
            <Button asChild variant="ghost">
              <Link to={groupPath}>Cancel</Link>
            </Button>
          </div>
        </form>

        <p className="text-sm text-muted-foreground">
          Logged by {entry.creator?.display_name ?? 'a former member'} on{' '}
          {formatDateTime(entry.created_at)}.
          {entry.updated_at && (
            <>
              {' '}
              Last changed by {entry.updater?.display_name ??
                'a former member'}{' '}
              on {formatDateTime(entry.updated_at)}.
            </>
          )}
        </p>

        <Separator />

        <section
          aria-labelledby="delete-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="delete-heading" className="font-heading font-semibold">
            Delete
          </h2>
          {remove.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                {entryErrorMessage(remove.error)}
              </AlertDescription>
            </Alert>
          )}
          {confirmingDelete ? (
            <div
              role="group"
              aria-label="Confirm deleting"
              className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
            >
              <p className="text-sm font-medium">
                Delete this entry? This can't be undone.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(undefined, done)}
                >
                  <Trash2 aria-hidden />
                  Delete for good
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="self-start text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 aria-hidden />
              Delete entry…
            </Button>
          )}
        </section>
      </div>
    </>
  )
}
