import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { groupKeys } from '@/features/groups/use-groups'
import { supabase } from '@/lib/supabase'
import type { Enums } from '@/types/database'

export type Member = {
  user_id: string
  role: Enums<'group_role'>
  created_at: string
  profile: { display_name: string } | null
}

const roleOrder: Record<Enums<'group_role'>, number> = {
  owner: 0,
  editor: 1,
  viewer: 2,
}

export const memberKeys = {
  list: (groupId: string) => ['members', groupId] as const,
}

// A group's members (FR-23): the owner first, then editors and viewers, by name.
export function useMembers(groupId: string) {
  return useQuery({
    queryKey: memberKeys.list(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select(
          'user_id, role, created_at, profile:profiles!memberships_user_id_fkey(display_name)',
        )
        .eq('group_id', groupId)
        .overrideTypes<Member[], { merge: false }>()
      if (error) throw error
      return data.sort(
        (a, b) =>
          roleOrder[a.role] - roleOrder[b.role] ||
          (a.profile?.display_name ?? '').localeCompare(
            b.profile?.display_name ?? '',
          ),
      )
    },
  })
}

// After a change to who's in a group or their roles, everything that shows
// roles, members or subjects may be out of date.
function useRefresh(groupId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: memberKeys.list(groupId) })
    queryClient.invalidateQueries({ queryKey: groupKeys.all })
    queryClient.invalidateQueries({ queryKey: ['subjects', groupId] })
  }
}

export function useChangeRole(groupId: string) {
  const refresh = useRefresh(groupId)
  return useMutation({
    mutationFn: async (input: {
      userId: string
      role: 'editor' | 'viewer'
    }) => {
      const { error } = await supabase.rpc('change_member_role', {
        target_group_id: groupId,
        target_user_id: input.userId,
        new_role: input.role,
      })
      if (error) throw error
    },
    onSettled: refresh,
  })
}

export function useRemoveMember(groupId: string) {
  const refresh = useRefresh(groupId)
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('remove_member', {
        target_group_id: groupId,
        target_user_id: userId,
      })
      if (error) throw error
    },
    onSettled: refresh,
  })
}

export function useTransferOwnership(groupId: string) {
  const refresh = useRefresh(groupId)
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.rpc('transfer_ownership', {
        target_group_id: groupId,
        new_owner_id: userId,
      })
      if (error) throw error
    },
    onSettled: refresh,
  })
}

// onLeft runs before the group data is refreshed: once refreshed, the group
// page shows "not found" (the user is no longer a member) and unmounts the
// leave form, so a callback given to mutate() would never run.
export function useLeaveGroup(groupId: string, onLeft: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (keepEntries: boolean) => {
      const { error } = await supabase.rpc('leave_group', {
        target_group_id: groupId,
        keep_entries: keepEntries,
      })
      if (error) throw error
    },
    onSuccess: () => {
      onLeft()
      queryClient.invalidateQueries({ queryKey: groupKeys.all })
    },
  })
}
