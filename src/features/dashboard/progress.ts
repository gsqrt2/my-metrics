import { differenceInCalendarDays, parseISO } from 'date-fns'

// FR-15: where a group with a duration stands today, in calendar days of the
// viewer's time zone. Both dates count, so 5 Oct – 27 Dec is 84 days.
export type DurationProgress =
  | { state: 'upcoming'; startsIn: number }
  | { state: 'running'; day: number; total: number; left: number }
  | { state: 'ended' }

export function durationProgress(
  startsOn: string,
  endsOn: string,
  today = new Date(),
): DurationProgress {
  const start = parseISO(startsOn)
  const end = parseISO(endsOn)
  const total = differenceInCalendarDays(end, start) + 1
  const day = differenceInCalendarDays(today, start) + 1
  if (day < 1) return { state: 'upcoming', startsIn: 1 - day }
  if (day > total) return { state: 'ended' }
  return { state: 'running', day, total, left: total - day }
}

// "Day 36 of 84 · 48 days left", "Starts in 5 days" or "Ended".
export function formatDurationProgress(progress: DurationProgress) {
  const days = (n: number) => (n === 1 ? '1 day' : `${n} days`)
  switch (progress.state) {
    case 'upcoming':
      return progress.startsIn === 1
        ? 'Starts tomorrow'
        : `Starts in ${days(progress.startsIn)}`
    case 'ended':
      return 'Ended'
    case 'running':
      return progress.left === 0
        ? `Day ${progress.day} of ${progress.total} · last day`
        : `Day ${progress.day} of ${progress.total} · ${days(progress.left)} left`
  }
}
