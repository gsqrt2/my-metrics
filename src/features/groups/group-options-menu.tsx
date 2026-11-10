import {
  ChevronDown,
  Download,
  Contact,
  EyeOff,
  Pencil,
  Ruler,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useExportCsv } from '@/features/export/use-export'
import { canEditGroup, type GroupRow } from '@/features/groups/types'

// The logbook's other pages behind one button, so the header stays one line
// on phones. Everyone gets the items they may use: members and privacy for
// all, management for owners and editors (§5), and the CSV export (FR-70).
export function GroupOptionsMenu({ group }: { group: GroupRow }) {
  const base = `/logbooks/${group.id}`
  const manage = canEditGroup(group)
  const exportCsv = useExportCsv(group)
  const items: {
    to: string
    label: string
    icon: LucideIcon
    show: boolean
  }[] = [
    { to: 'participants', label: 'Participants', icon: Users, show: manage },
    { to: 'metrics', label: 'Metrics', icon: Ruler, show: manage },
    { to: 'members', label: 'Members', icon: Contact, show: true },
    { to: 'invites', label: 'Invite people', icon: UserPlus, show: manage },
    { to: 'privacy', label: 'Privacy', icon: EyeOff, show: true },
    { to: 'edit', label: 'Edit logbook', icon: Pencil, show: manage },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Options
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {items
          .filter((item) => item.show)
          .map((item) => (
            <DropdownMenuItem key={item.to} asChild>
              <Link to={`${base}/${item.to}`}>
                <item.icon aria-hidden />
                {item.label}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuItem
          disabled={exportCsv.isPending}
          onSelect={() => exportCsv.mutate()}
        >
          <Download aria-hidden />
          {exportCsv.isPending ? 'Exporting…' : 'Export CSV'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
