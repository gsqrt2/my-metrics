import { formatDecimal } from '@/lib/numbers'

// A logged value with its attribute's decimals and unit: "72.4 kg".
export function formatValue(
  value: number,
  attribute: { precision: number; unit: string | null },
  locale?: string,
) {
  const number = formatDecimal(value, attribute.precision, locale)
  return attribute.unit ? `${number} ${attribute.unit}` : number
}
