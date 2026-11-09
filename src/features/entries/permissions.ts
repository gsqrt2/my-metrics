import type { Enums } from '@/types/database'

// Mirrors can_write_subject in the database (§5), so the app only offers what
// the database will accept. The database stays the authority.
export function canLogFor(
  group: {
    role: Enums<'group_role'>
    membersEditOwnSubjectOnly: boolean
    isArchived: boolean
  },
  subject: { linked_user_id: string | null; archived_at: string | null },
  userId: string | undefined,
) {
  if (group.isArchived || subject.archived_at) return false
  if (userId && subject.linked_user_id === userId) return true
  return (
    (group.role === 'owner' || group.role === 'editor') &&
    !group.membersEditOwnSubjectOnly
  )
}
