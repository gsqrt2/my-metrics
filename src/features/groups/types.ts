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
}

export function canEditGroup(group: GroupRow) {
  return group.role === 'owner' || group.role === 'editor' // FR-11
}
