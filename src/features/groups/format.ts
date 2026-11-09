import { parseISO } from 'date-fns'

import type { Enums } from '@/types/database'

export const roleLabels: Record<Enums<'group_role'>, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

// FR-15 duration as a date range in the viewer's locale (spec §6), e.g.
// "Oct 5 – Dec 27, 2026". Dates are plain calendar days, so they're read as
// local dates: no time zone can move them to the day before.
export function formatDuration(
  startsOn: string,
  endsOn: string,
  locale?: string,
) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).formatRange(
    parseISO(startsOn),
    parseISO(endsOn),
  )
}

export function formatMemberCount(count: number) {
  return count === 1 ? '1 member' : `${count} members`
}
