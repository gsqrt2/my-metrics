// Entries are stored with a time zone (timestamptz) and shown and entered in
// the viewer's local time (FR-50).

const pad = (n: number) => String(n).padStart(2, '0')

// A moment as the value of an <input type="datetime-local">, in local time,
// to the minute: "2026-11-09T08:05".
export function toLocalInputValue(date: Date) {
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

// The value of a datetime-local input back to a moment. Such values have no
// time zone, and the browser reads them as local time. Invalid input gives null.
export function fromLocalInputValue(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// The database allows a few minutes of clock skew for "not in the future".
export const FUTURE_SKEW_MS = 5 * 60 * 1000

export function formatDateTime(iso: string, locale?: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso))
}
