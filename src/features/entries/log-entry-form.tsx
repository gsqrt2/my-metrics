import { useState } from 'react'

import { FormField } from '@/components/form-field'
import { NativeSelect } from '@/components/native-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { attributeLabel } from '@/features/attributes/format'
import { useAuth } from '@/features/auth/use-auth'
import {
  fromLocalInputValue,
  toLocalInputValue,
} from '@/features/entries/datetime'
import { readLastUsed, rememberLastUsed } from '@/features/entries/last-used'
import { useLogEntries, type NewEntry } from '@/features/entries/use-entries'
import {
  defaultSubjectId,
  startingPoint,
  type LoggableGroup,
} from '@/features/entries/use-loggable-groups'
import {
  commentError,
  entryErrorMessage,
  MAX_COMMENT_LENGTH,
  measuredAtError,
  valueError,
} from '@/features/entries/validation'
import { parseDecimal } from '@/lib/numbers'

type Errors = Partial<Record<string, string>>

// FR-51 quick entry, the same form wherever it's opened from (plan step 6):
// logbook, participant, date and time, the logbook's metrics, one comment.
export function LogEntryForm({
  groups,
  presetGroupId,
  presetGroupName,
  onSaved,
  onCancel,
}: {
  groups: LoggableGroup[]
  presetGroupId?: string
  presetGroupName?: string
  onSaved: (groupId: string) => void
  onCancel: () => void
}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const log = useLogEntries()

  const [start] = useState(() => {
    const last = userId
      ? readLastUsed(userId)
      : { groupId: undefined, subjectByGroup: {} }
    return {
      ...startingPoint(groups, {
        presetGroupId,
        lastGroupId: last.groupId,
        lastSubjectByGroup: last.subjectByGroup,
        userId,
      }),
      lastSubjectByGroup: last.subjectByGroup,
    }
  })
  const [groupId, setGroupId] = useState(start.groupId)
  const [subjectId, setSubjectId] = useState(start.subjectId)
  const [measuredAt, setMeasuredAt] = useState(() =>
    toLocalInputValue(new Date()),
  )
  const [values, setValues] = useState<Record<string, string>>({})
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  // A logbook the user picked while values were typed in, waiting for them
  // to confirm that the values may go.
  const [switchTo, setSwitchTo] = useState<string | null>(null)

  const group = groups.find((g) => g.id === groupId)
  const presetUnavailable =
    presetGroupId !== undefined && !groups.some((g) => g.id === presetGroupId)
  const hasValues = Object.values(values).some((v) => v.trim() !== '')

  function selectGroup(id: string) {
    const next = groups.find((g) => g.id === id)
    setGroupId(id)
    setSubjectId(
      next ? defaultSubjectId(next, start.lastSubjectByGroup, userId) : '',
    )
    setValues({})
    setErrors({})
    setSwitchTo(null)
    log.reset()
  }

  function validate(target: LoggableGroup): Errors {
    const found: Errors = {}
    if (!subjectId) found.subject = 'Choose a participant.'
    const when = measuredAtError(measuredAt)
    if (when) found.measuredAt = when
    for (const attribute of target.attributes) {
      const error = valueError(values[attribute.id] ?? '', attribute)
      if (error) found[attribute.id] = error
    }
    if (!hasValues) found.form = 'Enter at least one value.'
    const tooLong = commentError(comment)
    if (tooLong) found.comment = tooLong
    return found
  }

  function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!group) {
      setErrors({ group: 'Choose a logbook.' })
      return
    }
    const found = validate(group)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const at = fromLocalInputValue(measuredAt)!.toISOString()
    const entries: NewEntry[] = group.attributes
      .filter((a) => (values[a.id] ?? '').trim() !== '')
      .map((a) => ({
        subject_id: subjectId,
        attribute_id: a.id,
        value: parseDecimal(values[a.id])!,
        measured_at: at,
        comment: comment.trim() || null,
      }))
    log.mutate(entries, {
      onSuccess: () => {
        if (userId) rememberLastUsed(userId, group.id, subjectId)
        onSaved(group.id)
      },
    })
  }

  const filled = Object.values(values).filter((v) => v.trim() !== '').length

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      {presetUnavailable && (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {presetGroupName ?? 'That logbook'} isn't ready for logging yet: it
          needs at least one metric and a participant you may log for.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="entry-group">Logbook</Label>
        <NativeSelect
          id="entry-group"
          value={groupId}
          aria-invalid={errors.group ? true : undefined}
          onChange={(event) => {
            const id = event.target.value
            if (hasValues) setSwitchTo(id)
            else selectGroup(id)
          }}
        >
          {!group && <option value="">Choose a logbook…</option>}
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </NativeSelect>
        {errors.group && (
          <p className="text-sm text-destructive">{errors.group}</p>
        )}
        {switchTo !== null && (
          <div
            role="group"
            aria-label="Confirm switching logbook"
            className="flex flex-col gap-2 rounded-lg border p-3"
          >
            <p className="text-sm">
              Switch to {groups.find((g) => g.id === switchTo)?.name}? The
              values you've entered will be discarded.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => selectGroup(switchTo)}
              >
                Switch and discard
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setSwitchTo(null)}
              >
                Keep editing
              </Button>
            </div>
          </div>
        )}
      </div>

      {group && (
        <>
          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-subject">Participant</Label>
            <NativeSelect
              id="entry-subject"
              value={subjectId}
              aria-invalid={errors.subject ? true : undefined}
              onChange={(event) => setSubjectId(event.target.value)}
            >
              {group.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.linked_user_id === userId ? `${s.name} (you)` : s.name}
                </option>
              ))}
            </NativeSelect>
            {errors.subject && (
              <p className="text-sm text-destructive">{errors.subject}</p>
            )}
          </div>

          <FormField
            id="entry-measured-at"
            label="When"
            type="datetime-local"
            value={measuredAt}
            max={toLocalInputValue(new Date())}
            error={errors.measuredAt}
            onChange={(event) => setMeasuredAt(event.target.value)}
          />

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-sm leading-none font-medium">
              Values
            </legend>
            <p className="-mt-1 text-sm text-muted-foreground">
              Fill in what you measured; leave the rest empty.
            </p>
            {group.attributes.map((attribute) => (
              <FormField
                key={attribute.id}
                id={`entry-value-${attribute.id}`}
                label={attributeLabel(attribute)}
                inputMode="decimal"
                autoComplete="off"
                value={values[attribute.id] ?? ''}
                error={errors[attribute.id]}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [attribute.id]: event.target.value,
                  }))
                }
              />
            ))}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="entry-comment">Comment (optional)</Label>
            <Textarea
              id="entry-comment"
              rows={2}
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="e.g. after breakfast"
              value={comment}
              aria-invalid={errors.comment ? true : undefined}
              onChange={(event) => setComment(event.target.value)}
            />
            {errors.comment && (
              <p className="text-sm text-destructive">{errors.comment}</p>
            )}
          </div>
        </>
      )}

      {(errors.form || log.isError) && (
        <Alert variant="destructive">
          <AlertDescription>
            {errors.form ?? entryErrorMessage(log.error!)}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={log.isPending || !group}>
          {log.isPending
            ? 'Saving…'
            : filled > 1
              ? `Save ${filled} values`
              : 'Save'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
