// Reads a number typed by a user, with either a dot or a comma as the decimal
// separator ("72.5" or "72,5"), since formats follow the browser (spec §6).
// Thousands separators aren't accepted: "1,234" would be ambiguous.
// Returns null for empty input and NaN for anything that isn't a number.
export function parseDecimal(input: string): number | null {
  const text = input.trim()
  if (text === '') return null
  if (!/^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text)) return NaN
  return Number(text.replace(',', '.'))
}

// A number in the viewer's locale with a fixed number of decimals.
export function formatDecimal(
  value: number,
  decimals: number,
  locale?: string,
) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
