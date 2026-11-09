import { differenceInMonths, differenceInYears, parseISO } from 'date-fns'

// Age from a birthdate (a plain calendar date) on a given day: in months up to
// two years, then in whole years.
export function formatAge(birthdate: string, today = new Date()) {
  const born = parseISO(birthdate)
  const months = differenceInMonths(today, born)
  if (months < 1) return 'under 1 month'
  if (months < 24) return months === 1 ? '1 month' : `${months} months`
  const years = differenceInYears(today, born)
  return `${years} years`
}

// Today as yyyy-mm-dd in the viewer's time zone, for date inputs and checks.
export function todayIso(today = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
}
