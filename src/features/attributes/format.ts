import type { AttributeFields } from '@/features/attributes/schemas'
import { formatDecimal } from '@/lib/numbers'

// Offered in the unit field; any other text is fine too (FR-40).
export const UNIT_SUGGESTIONS = [
  'kg',
  'lb',
  'cm',
  'in',
  'm',
  '%',
  'bpm',
  'mmHg',
  'kcal',
  'steps',
  'km',
  'min',
  'h',
  'reps',
]

// "Weight (kg)", or just "Mood" without a unit.
export function attributeLabel(
  attribute: Pick<AttributeFields, 'name' | 'unit'>,
) {
  return attribute.unit
    ? `${attribute.name} (${attribute.unit})`
    : attribute.name
}

// One line of details, e.g. "1 decimal · 40–250".
export function attributeDetails(attribute: AttributeFields, locale?: string) {
  const parts = [
    attribute.precision === 0
      ? 'Whole numbers'
      : attribute.precision === 1
        ? '1 decimal'
        : `${attribute.precision} decimals`,
  ]
  const min = attribute.min_value
  const max = attribute.max_value
  const show = (value: number) =>
    formatDecimal(value, decimalsOf(value), locale)
  if (min !== null && max !== null) parts.push(`${show(min)}–${show(max)}`)
  else if (min !== null) parts.push(`at least ${show(min)}`)
  else if (max !== null) parts.push(`at most ${show(max)}`)
  return parts.join(' · ')
}

function decimalsOf(value: number) {
  const [, fraction = ''] = String(value).split('.')
  return fraction.length
}
