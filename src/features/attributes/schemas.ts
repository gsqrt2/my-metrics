import { z } from 'zod'

import { parseDecimal } from '@/lib/numbers'
import type { Tables } from '@/types/database'

// Match the check constraints on public.attributes (FR-40, FR-80).
export const MAX_ATTRIBUTE_NAME_LENGTH = 80
export const MAX_UNIT_LENGTH = 20
export const PRECISIONS = [0, 1, 2, 3, 4] as const

const optionalNumber = z
  .string()
  .refine((text) => !Number.isNaN(parseDecimal(text)), 'Enter a number.')

export const attributeSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(
        MAX_ATTRIBUTE_NAME_LENGTH,
        `Use at most ${MAX_ATTRIBUTE_NAME_LENGTH} characters.`,
      ),
    unit: z
      .string()
      .trim()
      .max(MAX_UNIT_LENGTH, `Use at most ${MAX_UNIT_LENGTH} characters.`),
    precision: z.enum(['0', '1', '2', '3', '4']),
    minValue: optionalNumber,
    maxValue: optionalNumber,
  })
  .superRefine((values, ctx) => {
    const min = parseDecimal(values.minValue)
    const max = parseDecimal(values.maxValue)
    if (min !== null && max !== null && min > max) {
      ctx.addIssue({
        code: 'custom',
        message: "The maximum can't be below the minimum.",
        path: ['maxValue'],
      })
    }
  })

export type AttributeFormValues = z.input<typeof attributeSchema>
export type AttributeFormOutput = z.output<typeof attributeSchema>
export type AttributeFields = Pick<
  Tables<'attributes'>,
  'name' | 'unit' | 'precision' | 'min_value' | 'max_value'
>

export const emptyAttributeForm: AttributeFormValues = {
  name: '',
  unit: '',
  precision: '1',
  minValue: '',
  maxValue: '',
}

export function toAttributeForm(
  attribute: AttributeFields,
): AttributeFormValues {
  return {
    name: attribute.name,
    unit: attribute.unit ?? '',
    precision: String(attribute.precision) as AttributeFormValues['precision'],
    minValue: attribute.min_value === null ? '' : String(attribute.min_value),
    maxValue: attribute.max_value === null ? '' : String(attribute.max_value),
  }
}

export function toAttributeRow(values: AttributeFormOutput): AttributeFields {
  return {
    name: values.name,
    unit: values.unit || null,
    precision: Number(values.precision),
    min_value: parseDecimal(values.minValue),
    max_value: parseDecimal(values.maxValue),
  }
}
