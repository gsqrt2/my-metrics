import { CalendarRange, Users } from 'lucide-react'

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
export function GroupMeta({ group }: { group: GroupRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      <div className="flex gap-2">
        {group.isDefault && <Badge variant="secondary">Personal</Badge>}
        <Badge variant="outline">{roleLabels[group.role]}</Badge>
      </div>
      <span className="inline-flex items-center gap-1.5">
        <Users className="size-4" aria-hidden />
        {formatMemberCount(group.memberCount)}
      </span>
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
