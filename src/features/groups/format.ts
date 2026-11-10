import { parseISO } from 'date-fns'

import { formatDateRange } from '@/lib/dates'

import type { Enums } from '@/types/database'

export const roleLabels: Record<Enums<'group_role'>, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

// FR-15 duration as a date range, e.g. "05/10/2026 – 27/12/2026". Dates are
// plain calendar days, so they're read as local dates: no time zone can move
// them to the day before.
export function formatDuration(startsOn: string, endsOn: string) {
  return formatDateRange(parseISO(startsOn), parseISO(endsOn))
}

export function formatMemberCount(count: number) {
  return count === 1 ? '1 member' : `${count} members`
}
