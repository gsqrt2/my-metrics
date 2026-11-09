import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { todayIso } from '@/features/subjects/age'
import {
  SUBJECT_COLORS,
  subjectColorVar,
  subjectInkColor,
} from '@/features/subjects/colors'
import {
  MAX_SUBJECT_NAME_LENGTH,
  MIN_BIRTHDATE,
  subjectSchema,
  toSubjectRow,
  type SubjectFields,
  type SubjectFormOutput,
  type SubjectFormValues,
} from '@/features/subjects/schemas'

// Add and edit form for a subject: name, birthdate, colour (FR-30).
export function SubjectForm({
  defaultValues,
  nameHint,
  submitLabel,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
}: {
  defaultValues: SubjectFormValues
  nameHint?: string
  submitLabel: string
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error?: string
  onSubmit: (fields: SubjectFields) => void
}) {
  const form = useForm<SubjectFormValues, unknown, SubjectFormOutput>({
    resolver: zodResolver(subjectSchema()),
    defaultValues,
  })
  const { errors } = form.formState

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(toSubjectRow(values)))}
      noValidate
      className="flex max-w-xl flex-col gap-6"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <FormField
          id="subject-name"
          label="Name"
          maxLength={MAX_SUBJECT_NAME_LENGTH}
          placeholder="e.g. Mia"
          error={errors.name?.message}
          {...form.register('name')}
        />
        {nameHint && (
          <p className="text-sm text-muted-foreground">{nameHint}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <FormField
          id="subject-birthdate"
          label="Birthdate (optional)"
          type="date"
          min={MIN_BIRTHDATE}
          max={todayIso()}
          error={errors.birthdate?.message}
          {...form.register('birthdate')}
        />
        <p className="text-sm text-muted-foreground">
          Lets charts show measurements by age, e.g. for children's growth.
        </p>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm leading-none font-medium">
          Colour
        </legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          Marks this subject in charts and lists.
        </p>
        <div className="flex flex-wrap gap-2">
          {SUBJECT_COLORS.map((color) => (
            <label
              key={color.value}
              title={color.label}
              className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-full has-checked:ring-2 has-checked:ring-foreground has-checked:ring-offset-2 has-checked:ring-offset-background has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring/50"
            >
              <input
                type="radio"
                value={color.value}
                className="peer sr-only"
                {...form.register('color')}
              />
              <span
                aria-hidden
                className="size-8 rounded-full border border-black/10 dark:border-white/10"
                style={{ backgroundColor: subjectColorVar(color.value) }}
              />
              <span className="sr-only">{color.label}</span>
              <svg
                aria-hidden
                viewBox="0 0 16 16"
                className="pointer-events-none absolute hidden size-4 peer-checked:block"
                style={{ color: subjectInkColor(color.value) }}
              >
                <path
                  d="M3.5 8.5l3 3 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
        <Button asChild variant="ghost">
          <Link to={cancelTo}>Cancel</Link>
        </Button>
      </div>
    </form>
  )
}
