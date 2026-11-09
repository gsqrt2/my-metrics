import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/form-field'
import { NativeSelect } from '@/components/native-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { UNIT_SUGGESTIONS } from '@/features/attributes/format'
import {
  attributeSchema,
  MAX_ATTRIBUTE_NAME_LENGTH,
  MAX_UNIT_LENGTH,
  PRECISIONS,
  toAttributeRow,
  type AttributeFields,
  type AttributeFormOutput,
  type AttributeFormValues,
} from '@/features/attributes/schemas'

// Add and edit form for an attribute, shown as a "metric" (FR-40).
export function AttributeForm({
  defaultValues,
  entryCount = 0,
  submitLabel,
  pendingLabel,
  cancelTo,
  isPending,
  error,
  onSubmit,
}: {
  defaultValues: AttributeFormValues
  // Entries already logged for this attribute, for the FR-41 warning.
  entryCount?: number
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
  const unit = form.watch('unit')
  const precision = form.watch('precision')
  const meaningChanged =
    entryCount > 0 &&
    (unit.trim() !== defaultValues.unit.trim() ||
      precision !== defaultValues.precision)

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
          <NativeSelect
            id="attribute-precision"
            {...form.register('precision')}
          >
            {PRECISIONS.map((precision) => (
              <option key={precision} value={String(precision)}>
                {precision === 0
                  ? '0 (whole numbers)'
                  : `${precision} (e.g. ${(0).toFixed(precision).replace(/0$/, '5')})`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {meaningChanged && (
        <Alert>
          <AlertDescription>
            {entryCount === 1 ? '1 entry has' : `${entryCount} entries have`}{' '}
            already been logged. They keep their numbers: changing the unit
            (e.g. kg to lb) changes what they mean, and fewer decimals only
            changes how they're shown.
          </AlertDescription>
        </Alert>
      )}

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
