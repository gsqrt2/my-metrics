import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { SubjectColor } from '@/features/subjects/colors'
import type { SubjectFields } from '@/features/subjects/schemas'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Subject = Pick<
  Tables<'subjects'>,
  | 'id'
  | 'group_id'
  | 'name'
  | 'birthdate'
  | 'linked_user_id'
  | 'name_customized'
  | 'archived_at'
  | 'visibility_frozen'
> & { color: SubjectColor }

export const subjectKeys = {
  all: ['subjects'] as const,
  list: (groupId: string) => ['subjects', groupId] as const,
}

// All of a group's subjects, archived ones included, by name.
export async function fetchSubjects(groupId: string) {
  const { data, error } = await supabase
    .from('subjects')
    .select(
      'id, group_id, name, birthdate, color, linked_user_id, name_customized, archived_at, visibility_frozen',
    )
    .eq('group_id', groupId)
  if (error) throw error
  return data.sort((a, b) => a.name.localeCompare(b.name))
}

export function useSubjects(groupId: string) {
  return useQuery({
    queryKey: subjectKeys.list(groupId),
    queryFn: () => fetchSubjects(groupId),
  })
}

export function useCreateSubject(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields: SubjectFields) => {
      // Like groups: the app makes the id, see useCreateGroup.
      const id = crypto.randomUUID()
      const { error } = await supabase
        .from('subjects')
        .insert({ id, group_id: groupId, ...fields })
      if (error) throw error
      return id
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: subjectKeys.list(groupId) }),
  })
}

export function useUpdateSubject(subject: Pick<Subject, 'id' | 'group_id'>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      fields: Partial<SubjectFields> & { archived_at?: string | null },
    ) => {
      const { data, error } = await supabase
        .from('subjects')
        .update(fields)
        .eq('id', subject.id)
        .select('id')
      if (error) throw error
      // RLS turns a refused update into "no rows", not an error.
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: subjectKeys.list(subject.group_id),
      }),
  })
}
