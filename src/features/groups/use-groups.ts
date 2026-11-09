import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'

import { useAuth } from '@/features/auth/use-auth'
import type { GroupFields } from '@/features/groups/schemas'
import type { GroupRow } from '@/features/groups/types'
import { supabase } from '@/lib/supabase'
import type { Enums, Tables } from '@/types/database'

// Each group with the signed-in user's role in it and its member count.
const GROUP_COLUMNS = `
  id, name, description, starts_on, ends_on, default_for_user_id,
  me:memberships!inner(role),
  members:memberships(count)
`

type GroupQueryRow = Pick<
  Tables<'groups'>,
  | 'id'
  | 'name'
  | 'description'
  | 'starts_on'
  | 'ends_on'
  | 'default_for_user_id'
> & {
  me: { role: Enums<'group_role'> }[]
  members: { count: number }[]
}

function toGroup(row: GroupQueryRow): GroupRow {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    starts_on: row.starts_on,
    ends_on: row.ends_on,
    isDefault: row.default_for_user_id !== null,
    role: row.me[0].role,
    memberCount: row.members[0]?.count ?? 0,
  }
}

export const groupKeys = {
  all: ['groups'] as const,
  list: (userId: string) => ['groups', 'list', userId] as const,
  detail: (userId: string, groupId: string) =>
    ['groups', 'detail', userId, groupId] as const,
}

function useUserId() {
  const { session } = useAuth()
  return session?.user.id
}

// FR-12: every group the user is a member of. The default group comes first.
export function useGroups() {
  const userId = useUserId()
  return useQuery({
    queryKey: groupKeys.list(userId ?? ''),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select(GROUP_COLUMNS)
        .eq('me.user_id', userId!)
        .overrideTypes<GroupQueryRow[], { merge: false }>()
      if (error) throw error
      return data
        .map(toGroup)
        .sort(
          (a, b) =>
            Number(b.isDefault) - Number(a.isDefault) ||
            a.name.localeCompare(b.name),
        )
    },
  })
}

// One group, or null if it doesn't exist or the user isn't a member.
export function useGroup(groupId: string) {
  const userId = useUserId()
  return useQuery({
    queryKey: groupKeys.detail(userId ?? '', groupId),
    enabled: !!userId,
    queryFn: async () => {
      // Postgres accepts any 8-4-4-4-12 hex id; z.uuid() would also demand an
      // RFC version digit, which seeded ids like b0000000-… don't have.
      if (!z.guid().safeParse(groupId).success) return null
      const { data, error } = await supabase
        .from('groups')
        .select(GROUP_COLUMNS)
        .eq('id', groupId)
        .eq('me.user_id', userId!)
        .overrideTypes<GroupQueryRow[], { merge: false }>()
      if (error) throw error
      return data.length > 0 ? toGroup(data[0]) : null
    },
  })
}

// FR-80 limit, raised by the check_groups_per_user trigger.
export const GROUP_LIMIT_MESSAGE =
  "You're already in 50 groups, the most allowed. Leave a group to create a new one."

export function groupErrorMessage(error: Error) {
  return error.message === 'group_limit_reached'
    ? GROUP_LIMIT_MESSAGE
    : 'Saving failed. Please try again.'
}

export function useCreateGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields: GroupFields) => {
      // The id is made here because the new row can't be read back in the same
      // request: the owner membership that makes it visible is added by a
      // trigger after the insert (see the groups migration).
      const id = crypto.randomUUID()
      const { error } = await supabase.from('groups').insert({ id, ...fields })
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  })
}

export function useUpdateGroup(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields: GroupFields) => {
      const { data, error } = await supabase
        .from('groups')
        .update(fields)
        .eq('id', groupId)
        .select('id')
      if (error) throw error
      // RLS turns a refused update into "no rows", not an error.
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupKeys.all }),
  })
}
