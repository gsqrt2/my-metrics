import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { entryKeys } from '@/features/entries/use-entries'
import { supabase } from '@/lib/supabase'

export type Visibility = 'absolute' | 'relative'

type Setting = {
  subject_id: string
  attribute_id: string
  visibility: Visibility
}

export const visibilityKeys = {
  list: (groupId: string) => ['visibility', groupId] as const,
}

// The group's "% only" settings (FR-43). No row means actual values.
export function useVisibilitySettings(groupId: string) {
  return useQuery({
    queryKey: visibilityKeys.list(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('value_visibility')
        .select(
          'subject_id, attribute_id, visibility, subject:subjects!inner(group_id)',
        )
        .eq('subject.group_id', groupId)
      if (error) throw error
      return (data as unknown as Setting[]).map(
        ({ subject_id, attribute_id, visibility }) => ({
          subject_id,
          attribute_id,
          visibility,
        }),
      )
    },
  })
}

// Sets one subject's attribute to actual values (removes the row) or "% only".
// What others see changes with their next data load.
export function useSetVisibility(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      subjectId: string
      attributeId: string
      visibility: Visibility
    }) => {
      if (input.visibility === 'absolute') {
        const { error } = await supabase
          .from('value_visibility')
          .delete()
          .eq('subject_id', input.subjectId)
          .eq('attribute_id', input.attributeId)
        if (error) throw error
        return
      }
      // Not an upsert: that would also rewrite the key columns, which the app
      // may not change. Insert, or if a row exists, update it.
      const inserted = await supabase.from('value_visibility').insert({
        subject_id: input.subjectId,
        attribute_id: input.attributeId,
        visibility: 'relative',
      })
      const error =
        inserted.error?.code === '23505'
          ? (
              await supabase
                .from('value_visibility')
                .update({ visibility: 'relative' })
                .eq('subject_id', input.subjectId)
                .eq('attribute_id', input.attributeId)
            ).error
          : inserted.error
      if (error) throw error
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: visibilityKeys.list(groupId) })
      queryClient.invalidateQueries({ queryKey: entryKeys.all })
    },
  })
}
