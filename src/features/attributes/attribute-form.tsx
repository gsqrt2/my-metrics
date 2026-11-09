import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/form-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { directionLabels, UNIT_SUGGESTIONS } from '@/features/attributes/format'
import {
  attributeSchema,
  DIRECTIONS,
  MAX_ATTRIBUTE_NAME_LENGTH,
  MAX_UNIT_LENGTH,
  PRECISIONS,
  toAttributeRow,
  type AttributeFields,
  type AttributeFormOutput,
  type AttributeFormValues,
} from '@/features/attributes/schemas'

const directionHints = {
  higher_better: 'e.g. steps, or a child’s height',
  lower_better: 'e.g. weight in a diet',
  neutral: 'Changes are shown without colour',
}

// Add and edit form for an attribute, shown as a "metric" (FR-40).
export function AttributeForm({
  defaultValues,
  notice,
  submitLabel,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
}: {
  defaultValues: AttributeFormValues
  notice?: React.ReactNode
  submitLabel: string
  pendingLabel: string
  cancelTo: string
  isPending: boolean
  error?: string
  onSubmit: (fields: AttributeFields) => void
}) {
  const form = useForm<AttributeFormValues, unknown, AttributeFormOutput>({
    resolver: zodResolver(attributeSchema),
    defaultValues,
  })
  const { errors } = form.formState

  return (
    <form
      onSubmit={form.handleSubmit((values) => onSubmit(toAttributeRow(values)))}
      noValidate
      className="flex max-w-xl flex-col gap-6"
    >
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <FormField
        id="attribute-name"
        label="Name"
        maxLength={MAX_ATTRIBUTE_NAME_LENGTH}
        placeholder="e.g. Weight"
        error={errors.name?.message}
        {...form.register('name')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <FormField
            id="attribute-unit"
            label="Unit (optional)"
            maxLength={MAX_UNIT_LENGTH}
            placeholder="e.g. kg"
            list="attribute-unit-suggestions"
            autoComplete="off"
            error={errors.unit?.message}
            {...form.register('unit')}
          />
          <datalist id="attribute-unit-suggestions">
            {UNIT_SUGGESTIONS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="attribute-precision">Decimals</Label>
          <select
            id="attribute-precision"
            className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base md:text-sm dark:bg-input/30"
            {...form.register('precision')}
          >
            {PRECISIONS.map((precision) => (
              <option key={precision} value={String(precision)}>
                {precision === 0
                  ? '0 (whole numbers)'
                  : `${precision} (e.g. ${(0).toFixed(precision).replace(/0$/, '5')})`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm leading-none font-medium">
          Which way is progress?
        </legend>
        <div className="flex flex-col gap-2">
          {DIRECTIONS.map((direction) => (
            <label
              key={direction}
              className="flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 has-checked:border-foreground has-focus-visible:outline-3 has-focus-visible:outline-ring/50"
            >
              <input
                type="radio"
                value={direction}
                className="mt-1 accent-foreground"
                {...form.register('direction')}
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium">
                  {directionLabels[direction]}
                </span>
                <span className="text-sm text-muted-foreground">
                  {directionHints[direction]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm leading-none font-medium">
          Allowed values (optional)
        </legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          Catches typos when logging, like 720 instead of 72.0. Entries already
          logged are kept as they are.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            id="attribute-min"
            label="Minimum"
            inputMode="decimal"
            autoComplete="off"
            error={errors.minValue?.message}
            {...form.register('minValue')}
          />
          <FormField
            id="attribute-max"
            label="Maximum"
            inputMode="decimal"
            autoComplete="off"
            error={errors.maxValue?.message}
            {...form.register('maxValue')}
          />
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
