import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { DateTimeField } from '@/components/date-field'
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
import { EntryValue } from '@/features/entries/entry-value'
import { canLogFor } from '@/features/entries/permissions'
import {
  useEntry,
  useEntryMoment,
  useSaveEntryMoment,
  type Entry,
} from '@/features/entries/use-entries'
import {
  useLoggableGroups,
  type LoggableAttribute,
} from '@/features/entries/use-loggable-groups'
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

type Errors = Partial<Record<string, string>>

// FR-52, extended from the backlog: editing an entry edits everything logged
// for its participant at that moment, with every metric of the logbook
// available. Values change, empty fields add values, cleared fields delete
// them; the time and the comment apply to all.
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
  return <LoadMoment entry={found} groupPath={groupPath} back={back} />
}

// The other values of the moment, and the metrics the user may log for the
// participant (active ones, without those kept "% only" by someone else).
function LoadMoment({
  entry,
  groupPath,
  back,
}: {
  entry: Entry
  groupPath: string
  back: React.ReactNode
}) {
  const moment = useEntryMoment(entry.subject.id, entry.measured_at)
  const groups = useLoggableGroups(true)

  if (moment.isPending || groups.isPending) return null
  if (moment.isError || groups.isError) {
    return (
      <>
        {back}
        <Alert variant="destructive">
          <AlertDescription>
            The entry couldn't be loaded. Please reload the page.
          </AlertDescription>
        </Alert>
      </>
    )
  }
  const group = groups.data.find((g) => g.id === entry.subject.group_id)
  const subject = group?.subjects.find((s) => s.id === entry.subject.id)
  const fields =
    group && subject
      ? group.attributes.filter(
          (a) => !subject.lockedAttributeIds.includes(a.id),
        )
      : []
  return (
    <EditMoment
      entry={entry}
      entries={moment.data}
      fields={fields}
      groupPath={groupPath}
      back={back}
    />
  )
}

function EditMoment({
  entry,
  entries,
  fields,
  groupPath,
  back,
}: {
  entry: Entry
  entries: Entry[]
  fields: LoggableAttribute[]
  groupPath: string
  back: React.ReactNode
}) {
  const navigate = useNavigate()
  const save = useSaveEntryMoment(entry.subject.id, entry.measured_at)
  const before = new Map(entries.map((e) => [e.attribute.id, e]))
  // Values of the moment that can't be changed here, e.g. of archived
  // metrics. They keep their time and comment.
  const fixed = entries.filter(
    (e) => !fields.some((field) => field.id === e.attribute.id),
  )
  const comments = new Set(
    entries
      .filter((e) => fields.some((field) => field.id === e.attribute.id))
      .map((e) => e.comment ?? ''),
  )

  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [
        field.id,
        before.has(field.id) ? String(before.get(field.id)!.value) : '',
      ]),
    ),
  )
  const [measuredAt, setMeasuredAt] = useState(() =>
    toLocalInputValue(new Date(entry.measured_at)),
  )
  const [comment, setComment] = useState(entry.comment ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const done = { onSuccess: () => navigate(groupPath) }
  const savedCount = entries.length - fixed.length
  const history = momentHistory(entries.length > 0 ? entries : [entry])

  function validate(): Errors {
    const found: Errors = {}
    for (const field of fields) {
      const text = values[field.id] ?? ''
      // Limits only apply to new and changed values (FR-40).
      const unchanged =
        before.has(field.id) &&
        parseDecimal(text) === before.get(field.id)!.value
      const error = unchanged ? undefined : valueError(text, field)
      if (error) found[field.id] = error
    }
    if (fields.every((field) => (values[field.id] ?? '').trim() === '')) {
      found.form =
        'Enter at least one value. To remove them all, delete the entry below.'
    }
    const when = measuredAtError(measuredAt)
    if (when) found.measuredAt = when
    const tooLong = commentError(comment)
    if (tooLong) found.comment = tooLong
    return found
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    save.mutate(
      {
        measuredAt: fromLocalInputValue(measuredAt)!.toISOString(),
        comment,
        values: Object.fromEntries(
          fields.map((field) => {
            const text = (values[field.id] ?? '').trim()
            return [field.id, text === '' ? null : parseDecimal(text)!]
          }),
        ),
      },
      done,
    )
  }

  function deleteAll() {
    save.mutate(
      {
        measuredAt: entry.measured_at,
        comment: '',
        values: Object.fromEntries(fields.map((field) => [field.id, null])),
      },
      done,
    )
  }

  return (
    <>
      {back}
      <PageHeader
        title="Edit entry"
        description={`${entry.subject.name} · ${formatDateTime(entry.measured_at)}`}
      />
      <div className="flex max-w-xl flex-col gap-8">
        <div className="flex items-center gap-3">
          <SubjectAvatar
            name={entry.subject.name}
            color={entry.subject.color}
          />
          <span className="text-sm font-medium">{entry.subject.name}</span>
        </div>

        <form onSubmit={submit} noValidate className="flex flex-col gap-5">
          {save.isError && !confirmingDelete && (
            <Alert variant="destructive">
              <AlertDescription>
                {entryErrorMessage(save.error)}
              </AlertDescription>
            </Alert>
          )}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 text-sm font-medium">Values</legend>
            {fields.map((field) => (
              <FormField
                key={field.id}
                id={`entry-value-${field.id}`}
                label={attributeLabel(field)}
                inputMode="decimal"
                autoComplete="off"
                value={values[field.id] ?? ''}
                error={errors[field.id]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [field.id]: event.target.value,
                  }))
                }
              />
            ))}
            <p className="text-sm text-muted-foreground">
              Leave a field empty to remove its value.
            </p>
            {errors.form && (
              <p className="text-sm text-destructive">{errors.form}</p>
            )}
          </fieldset>
          {fixed.length > 0 && (
            <div className="flex flex-col gap-2 text-sm">
              <p className="text-muted-foreground">
                Also logged at this time, and not changed here:
              </p>
              <ul className="flex flex-col gap-1">
                {fixed.map((e) => (
                  <li key={e.id} className="flex flex-wrap gap-x-2">
                    <span>{e.attribute.name}</span>
                    <EntryValue
                      value={e.value}
                      pctChange={null}
                      attribute={e.attribute}
                    />
                    {e.attribute.archived_at && (
                      <span className="text-muted-foreground">(archived)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <DateTimeField
            id="entry-measured-at"
            label="When"
            value={measuredAt}
            max={toLocalInputValue(new Date())}
            error={errors.measuredAt}
            onChange={setMeasuredAt}
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
            {comments.size > 1 && (
              <p className="text-sm text-muted-foreground">
                These values had different comments. Saving gives them all this
                one.
              </p>
            )}
            {errors.comment && (
              <p className="text-sm text-destructive">{errors.comment}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && !confirmingDelete ? 'Saving…' : 'Save changes'}
            </Button>
            <Button asChild variant="ghost">
              <Link to={groupPath}>Cancel</Link>
            </Button>
          </div>
        </form>

        <p className="text-sm text-muted-foreground">
          Logged by {history.loggedBy} on {formatDateTime(history.loggedAt)}.
          {history.changedAt && (
            <>
              {' '}
              Last changed by {history.changedBy} on{' '}
              {formatDateTime(history.changedAt)}.
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
          {save.isError && confirmingDelete && (
            <Alert variant="destructive">
              <AlertDescription>
                {entryErrorMessage(save.error)}
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
                {savedCount === 1
                  ? "Delete this entry? This can't be undone."
                  : `Delete the ${savedCount} values logged at this time? This can't be undone.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={save.isPending}
                  onClick={deleteAll}
                >
                  <Trash2 aria-hidden />
                  Delete for good
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmingDelete(false)
                    save.reset()
                  }}
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

// Who logged the moment (its first value) and who last changed it: a changed
// value, or a value added later.
function momentHistory(entries: Entry[]) {
  const name = (person: { display_name: string } | null) =>
    person?.display_name ?? 'a former member'
  const first = entries.reduce((a, b) => (b.created_at < a.created_at ? b : a))
  const latest = entries
    .map((e) =>
      e.updated_at
        ? { at: e.updated_at, by: name(e.updater) }
        : { at: e.created_at, by: name(e.creator) },
    )
    .reduce((a, b) => (b.at > a.at ? b : a))
  // Values logged together are created within the same instant.
  const changed =
    new Date(latest.at).getTime() - new Date(first.created_at).getTime() > 1000
  return {
    loggedBy: name(first.creator),
    loggedAt: first.created_at,
    changedBy: latest.by,
    changedAt: changed ? latest.at : null,
  }
}
