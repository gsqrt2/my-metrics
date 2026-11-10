import { CalendarRange, Users } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/components/ui/badge'
import {
  formatDuration,
  formatMemberCount,
  roleLabels,
} from '@/features/groups/format'
import type { GroupRow } from '@/features/groups/types'
import {
  durationProgress,
  formatDurationProgress,
} from '@/features/dashboard/progress'

// The facts shown under a group's name: personal, role, members, duration.
// On the group page the member count links to the member list; in the group
// list the whole card is already a link.
export function GroupMeta({
  group,
  linkMembers = false,
}: {
  group: GroupRow
  linkMembers?: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <div className="flex gap-2">
        {group.isDefault && <Badge variant="secondary">Personal</Badge>}
        <Badge variant="outline">{roleLabels[group.role]}</Badge>
      </div>
      {linkMembers ? (
        <Link
          to={`/logbooks/${group.id}/members`}
          className="inline-flex items-center gap-1.5 underline-offset-4 hover:text-foreground hover:underline"
        >
          <Users className="size-4" aria-hidden />
          {formatMemberCount(group.memberCount)}
        </Link>
      ) : (
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" aria-hidden />
          {formatMemberCount(group.memberCount)}
        </span>
      )}
      {group.starts_on && group.ends_on && (
        <span className="inline-flex items-center gap-1.5">
          <CalendarRange className="size-4" aria-hidden />
          <span className="sr-only">Runs </span>
          {formatDuration(group.starts_on, group.ends_on)}
          <span aria-hidden>·</span>
          {formatDurationProgress(
            durationProgress(group.starts_on, group.ends_on),
          )}
        </span>
      )}
    </div>
  )
}
