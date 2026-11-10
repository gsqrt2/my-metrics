// Dates are shown and typed the European way, dd/mm/yyyy with 24-hour times,
// whatever the browser's language (decided 2026-11-10). British English gives
// exactly that while keeping English month names for chart axes.
export const DATE_LOCALE = 'en-GB'

const pad = (n: number) => String(n).padStart(2, '0')

const dateFormat = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFormat = new Intl.DateTimeFormat(DATE_LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

// "09/11/2026"
export function formatDate(date: Date) {
  return dateFormat.format(date)
}

// "09/11/2026, 07:30"
export function formatDateTime(date: Date) {
  return dateTimeFormat.format(date)
}

// "05/10/2026 – 27/12/2026"
export function formatDateRange(from: Date, to: Date) {
  return dateFormat.formatRange(from, to)
}

// A plain calendar date (yyyy-mm-dd) as typed: "05/10/2026".
export function isoToDayText(iso: string) {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[3]}/${match[2]}/${match[1]}` : ''
}

// What was typed as dd/mm/yyyy, as yyyy-mm-dd: '' when empty, null when it
// isn't a real date. One-digit days and months, and dots or dashes, are fine.
export function dayTextToIso(text: string): string | null {
  const trimmed = text.trim()
  if (trimmed === '') return ''
  const match = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (!match) return null
  const [, d, m, y] = match.map(Number)
  const date = new Date(y, m - 1, d)
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d
  ) {
    return null // e.g. 31/02/2026
  }
  return `${y}-${pad(m)}-${pad(d)}`
}

// A time typed as hh:mm (24 hours), normalised to two digits, or null.
export function parseTime(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})[:.](\d{2})$/)
  if (!match) return null
  const [h, m] = [Number(match[1]), Number(match[2])]
  if (h > 23 || m > 59) return null
  return `${pad(h)}:${pad(m)}`
}

export const DATE_FORMAT_MESSAGE = 'Enter a date as dd/mm/yyyy.'

export const isIsoDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
