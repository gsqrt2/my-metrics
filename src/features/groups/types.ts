import type { Enums, Tables } from '@/types/database'

// A group as the app shows it: with the signed-in user's role in it.
export type GroupRow = Pick<
  Tables<'groups'>,
  'id' | 'name' | 'description' | 'starts_on' | 'ends_on'
> & {
  isDefault: boolean
  role: Enums<'group_role'>
  memberCount: number
  // §5 "Members can only edit their own subject" (set by the owner, step 12).
  membersEditOwnSubjectOnly: boolean
  isArchived: boolean
  archivedAt: string | null
}

// FR-11: owners and editors manage a group, unless it's archived (read-only
// for everyone, step 14).
export function canEditGroup(group: GroupRow) {
  return (
    !group.isArchived && (group.role === 'owner' || group.role === 'editor')
  )
}

// Why a management page can't be used: archived, or the user's role.
export function cantManageText(group: GroupRow, roleText: string) {
  return group.isArchived
    ? 'This logbook is archived, so nothing in it can be changed.'
    : roleText
}
