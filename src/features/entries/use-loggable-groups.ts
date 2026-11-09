import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/use-auth'
import type { SubjectColor } from '@/features/subjects/colors'
import { canLogFor } from '@/features/entries/permissions'
import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

export type LoggableSubject = {
  id: string
  name: string
  color: SubjectColor
  linked_user_id: string | null
}

export type LoggableAttribute = Pick<
  Tables<'attributes'>,
  'id' | 'name' | 'unit' | 'precision' | 'min_value' | 'max_value'
>

// A group the user can log in: its active attributes in their order, and the
// active subjects they may log for (their own first).
export type LoggableGroup = {
  id: string
  name: string
  subjects: LoggableSubject[]
  attributes: LoggableAttribute[]
}

type Row = Pick<
  Tables<'groups'>,
  | 'id'
  | 'name'
  | 'default_for_user_id'
  | 'members_edit_own_subject_only'
  | 'archived_at'
> & {
  me: { role: Enums<'group_role'> }[]
  subjects: (LoggableSubject & { archived_at: string | null })[]
  attributes: (LoggableAttribute & {
    sort_order: number
    archived_at: string | null
  })[]
}

export function toLoggableGroups(rows: Row[], userId: string): LoggableGroup[] {
  return rows
    .map((row) => {
      const group = {
        role: row.me[0].role,
        membersEditOwnSubjectOnly: row.members_edit_own_subject_only,
        isArchived: row.archived_at !== null,
      }
      const subjects = row.subjects
        .filter((s) => canLogFor(group, s, userId))
        .sort(
          (a, b) =>
            Number(b.linked_user_id === userId) -
              Number(a.linked_user_id === userId) ||
            a.name.localeCompare(b.name),
        )
        .map(({ id, name, color, linked_user_id }) => ({
          id,
          name,
          color,
          linked_user_id,
        }))
      const attributes = row.attributes
        .filter((a) => !a.archived_at)
        .sort((a, b) => a.sort_order - b.sort_order)
        .map(({ id, name, unit, precision, min_value, max_value }) => ({
          id,
          name,
          unit,
          precision,
          min_value,
          max_value,
        }))
      return {
        id: row.id,
        name: row.name,
        isDefault: row.default_for_user_id !== null,
        subjects,
        attributes,
      }
    })
    .filter((g) => g.subjects.length > 0 && g.attributes.length > 0)
    .sort(
      (a, b) =>
        Number(b.isDefault) - Number(a.isDefault) ||
        a.name.localeCompare(b.name),
    )
    .map(({ id, name, subjects, attributes }) => ({
      id,
      name,
      subjects,
      attributes,
    }))
}

// The groups shown in the "Log entry" form: only those the user can log in.
export function useLoggableGroups(enabled: boolean) {
  const { session } = useAuth()
  const userId = session?.user.id
  return useQuery({
    queryKey: ['loggable-groups', userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(
          `id, name, default_for_user_id, members_edit_own_subject_only, archived_at,
           me:memberships!inner(role),
           subjects(id, name, color, linked_user_id, archived_at),
           attributes(id, name, unit, precision, min_value, max_value, sort_order, archived_at)`,
        )
        .eq('me.user_id', userId!)
        .overrideTypes<Row[], { merge: false }>()
      if (error) throw error
      return toLoggableGroups(data, userId!)
    },
  })
}

// Where the form starts (agreed flow, plan step 6):
// - logbook: the one it was opened from, else the last one used, else the only
//   one; none if it's ambiguous
// - participant: the user's own in that logbook, else the last one used there,
//   else the first
export function startingPoint(
  groups: LoggableGroup[],
  options: {
    presetGroupId?: string
    lastGroupId?: string
    lastSubjectByGroup: Record<string, string>
    userId?: string
  },
) {
  const find = (id?: string) => groups.find((g) => g.id === id)
  const group =
    (options.presetGroupId
      ? find(options.presetGroupId)
      : (find(options.lastGroupId) ??
        (groups.length === 1 ? groups[0] : undefined))) ?? undefined
  return {
    groupId: group?.id ?? '',
    subjectId: group
      ? defaultSubjectId(group, options.lastSubjectByGroup, options.userId)
      : '',
  }
}

export function defaultSubjectId(
  group: LoggableGroup,
  lastSubjectByGroup: Record<string, string>,
  userId?: string,
) {
  const own = group.subjects.find((s) => userId && s.linked_user_id === userId)
  const last = group.subjects.find((s) => s.id === lastSubjectByGroup[group.id])
  return (own ?? last ?? group.subjects[0])?.id ?? ''
}
