import { DateTimeField } from '@/components/date-field'
import { FormField } from '@/components/form-field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { attributeLabel } from '@/features/attributes/format'
import { toLocalInputValue } from '@/features/entries/datetime'
import type { LoggableAttribute } from '@/features/entries/use-loggable-groups'
import { MAX_COMMENT_LENGTH } from '@/features/entries/validation'

export type MomentErrors = Partial<Record<string, string>>

// What logging and editing an entry have in common (FR-50, FR-51): when, a
// value per metric, and one comment. The forms around it add the rest
// (logbook and participant, or what can't be changed) and do the saving.
export function MomentFields({
  fields,
  values,
  onValueChange,
  measuredAt,
  onMeasuredAtChange,
  comment,
  onCommentChange,
  errors,
  valuesHint,
  valuesNote,
  afterValues,
  commentNote,
}: {
  fields: LoggableAttribute[]
  values: Record<string, string>
  onValueChange: (attributeId: string, value: string) => void
  measuredAt: string
  onMeasuredAtChange: (value: string) => void
  comment: string
  onCommentChange: (value: string) => void
  errors: MomentErrors
  valuesHint: string
  // Shown above the value fields, e.g. which metrics can't be logged.
  valuesNote?: React.ReactNode
  // Shown below them, e.g. values of the moment that can't be changed.
  afterValues?: React.ReactNode
  // Shown below the comment.
  commentNote?: React.ReactNode
}) {
  return (
    <>
      <DateTimeField
        id="entry-measured-at"
        label="When"
        value={measuredAt}
        max={toLocalInputValue(new Date())}
        error={errors.measuredAt}
        onChange={onMeasuredAtChange}
      />

      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-sm leading-none font-medium">
          Values
        </legend>
        <p className="-mt-1 text-sm text-muted-foreground">{valuesHint}</p>
        {valuesNote}
        {fields.map((attribute) => (
          <FormField
            key={attribute.id}
            id={`entry-value-${attribute.id}`}
            label={attributeLabel(attribute)}
            inputMode="decimal"
            autoComplete="off"
            value={values[attribute.id] ?? ''}
            error={errors[attribute.id]}
            onChange={(event) =>
              onValueChange(attribute.id, event.target.value)
            }
          />
        ))}
      </fieldset>
      {afterValues}

      <div className="flex flex-col gap-2">
        <Label htmlFor="entry-comment">Comment (optional)</Label>
        <Textarea
          id="entry-comment"
          rows={2}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="e.g. after breakfast"
          value={comment}
          aria-invalid={errors.comment ? true : undefined}
          onChange={(event) => onCommentChange(event.target.value)}
        />
        {commentNote}
        {errors.comment && (
          <p className="text-sm text-destructive">{errors.comment}</p>
        )}
      </div>
    </>
  )
}
