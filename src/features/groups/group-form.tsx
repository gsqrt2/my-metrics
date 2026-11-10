import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { DateField } from '@/components/date-field'
import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  groupSchema,
  MAX_GROUP_DESCRIPTION_LENGTH,
  MAX_GROUP_NAME_LENGTH,
  toGroupRow,
  type GroupFields,
  type GroupFormOutput,
  type GroupFormValues,
} from '@/features/groups/schemas'

// Create and edit form for a group: name, description, duration (FR-10, FR-15).
export function GroupForm({
  defaultValues,
  submitLabel,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
}: {
  defaultValues: GroupFormValues
  submitLabel: string
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error?: string
  onSubmit: (fields: GroupFields) => void
}) {
  const form = useForm<GroupFormValues, unknown, GroupFormOutput>({
    resolver: zodResolver(groupSchema),
    defaultValues,
  })
  const { errors } = form.formState
  const hasDuration = form.watch('hasDuration')

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(toGroupRow(values)))}
      noValidate
      className="flex max-w-xl flex-col gap-6"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField
        id="group-name"
        label="Name"
        maxLength={MAX_GROUP_NAME_LENGTH}
        placeholder="e.g. Kids, Diet Challenge"
        error={errors.name?.message}
        {...form.register('name')}
      />

      <div className="flex flex-col gap-2">
        <Label htmlFor="group-description">Description (optional)</Label>
        <Textarea
          id="group-description"
          rows={3}
          maxLength={MAX_GROUP_DESCRIPTION_LENGTH}
          placeholder="What you track here, and how often"
          aria-invalid={errors.description ? true : undefined}
          aria-describedby={
            errors.description ? 'group-description-error' : undefined
          }
          {...form.register('description')}
        />
        {errors.description && (
          <p id="group-description-error" className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      <fieldset className="flex flex-col gap-4">
        <legend className="sr-only">Duration</legend>
        <div className="flex items-start gap-3">
          <Controller
            control={form.control}
            name="hasDuration"
            render={({ field }) => (
              <Checkbox
                id="group-has-duration"
                checked={field.value}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                onBlur={field.onBlur}
                className="mt-0.5"
              />
            )}
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="group-has-duration">Runs between two dates</Label>
            <p className="text-sm text-muted-foreground">
              For a challenge with a start and an end, like a 12-week diet.
              Entries outside the dates are still allowed.
            </p>
          </div>
        </div>
        {hasDuration && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="startsOn"
              render={({ field }) => (
                <DateField
                  id="group-starts-on"
                  label="Start date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.startsOn?.message}
                />
              )}
            />
            <Controller
              control={form.control}
              name="endsOn"
              render={({ field }) => (
                <DateField
                  id="group-ends-on"
                  label="End date"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errors.endsOn?.message}
                />
              )}
            />
          </div>
        )}
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
