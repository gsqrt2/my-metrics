import {
  FUTURE_SKEW_MS,
  fromLocalInputValue,
} from '@/features/entries/datetime'
import { formatDecimal, parseDecimal } from '@/lib/numbers'

export const MAX_COMMENT_LENGTH = 500 // FR-80

export type ValueRules = {
  precision: number
  min_value: number | null
  max_value: number | null
}

// Checks one typed value against its attribute (FR-40). Empty is fine here;
// whether any value is needed is up to the form.
export function valueError(
  text: string,
  rules: ValueRules,
  locale?: string,
): string | undefined {
  const value = parseDecimal(text)
  if (value === null) return undefined
  if (Number.isNaN(value)) return 'Enter a number.'

  const decimals = text.trim().split(/[.,]/)[1]?.length ?? 0
  if (decimals > rules.precision) {
    return rules.precision === 0
      ? 'Use a whole number.'
      : `Use at most ${rules.precision} ${rules.precision === 1 ? 'decimal' : 'decimals'}.`
  }

  const show = (n: number) => formatDecimal(n, decimalsOf(n), locale)
  const { min_value: min, max_value: max } = rules
  if ((min !== null && value < min) || (max !== null && value > max)) {
    if (min !== null && max !== null) {
      return `Use a value from ${show(min)} to ${show(max)}.`
    }
    return min !== null
      ? `Use a value of at least ${show(min)}.`
      : `Use a value of at most ${show(max!)}.`
  }
  return undefined
}

// FR-50, FR-53: a date and time is needed and can't be in the future.
export function measuredAtError(text: string, now = new Date()) {
  const date = fromLocalInputValue(text)
  if (!date) return 'Choose a date and time.'
  if (date.getTime() > now.getTime() + FUTURE_SKEW_MS) {
    return "The time can't be in the future."
  }
  return undefined
}

export function commentError(text: string) {
  return text.trim().length > MAX_COMMENT_LENGTH
    ? `Use at most ${MAX_COMMENT_LENGTH} characters.`
    : undefined
}

function decimalsOf(value: number) {
  return String(value).split('.')[1]?.length ?? 0
}

// Messages for the errors the database raises on purpose.
export function entryErrorMessage(error: Error & { code?: string }) {
  if (error.code === '23505') {
    return 'There is already an entry for this participant and metric at that time. Pick another time, or edit that entry.'
  }
  if (error.message === 'measured_at_in_future') {
    return "The time can't be in the future."
  }
  if (error.message === 'value_out_of_range') {
    return 'A value is outside what the metric allows.'
  }
  if (error.code === '42501' || error.message === 'not_allowed') {
    return "You can't log or change entries for this participant or metric."
  }
  return 'Saving failed. Please try again.'
}
