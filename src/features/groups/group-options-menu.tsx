import { ChevronDown, Pencil, Ruler, Users } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { GroupRow } from '@/features/groups/types'

// The logbook's management pages behind one button, so the header stays one
// line on phones as later steps add members, archiving and so on.
export function GroupOptionsMenu({ group }: { group: GroupRow }) {
  const base = `/logbooks/${group.id}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Options
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem asChild>
          <Link to={`${base}/participants`}>
            <Users aria-hidden />
            Participants
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`${base}/metrics`}>
            <Ruler aria-hidden />
            Metrics
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`${base}/edit`}>
            <Pencil aria-hidden />
            Edit logbook
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
