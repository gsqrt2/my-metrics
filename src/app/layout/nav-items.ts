import { LayoutGrid, UserRound, type LucideIcon } from 'lucide-react'

export type NavItem = {
  label: string
  to: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: 'Groups', to: '/groups', icon: LayoutGrid },
  { label: 'Profile', to: '/profile', icon: UserRound },
]
