import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AttributeFields } from '@/features/attributes/schemas'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Attribute = Pick<
  Tables<'attributes'>,
  | 'id'
  | 'group_id'
  | 'name'
  | 'unit'
  | 'precision'
  | 'min_value'
  | 'max_value'
  | 'sort_order'
  | 'archived_at'
>

export const attributeKeys = {
  list: (groupId: string) => ['attributes', groupId] as const,
}

// All of a group's attributes, archived ones included, in their order.
export function useAttributes(groupId: string) {
  return useQuery({
    queryKey: attributeKeys.list(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attributes')
        .select(
          'id, group_id, name, unit, precision, min_value, max_value, sort_order, archived_at',
        )
        .eq('group_id', groupId)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
}

// Messages for the errors the database raises on purpose.
export function attributeErrorMessage(error: Error & { code?: string }) {
  if (error.code === '23505') {
    return 'This logbook already has a metric with that name.'
  }
  if (error.message === 'attribute_limit_reached') {
    return 'This logbook already has 100 metrics, the most allowed.'
  }
  return 'Saving failed. Please try again.'
}

export function useCreateAttribute(groupId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (fields: AttributeFields) => {
      // Like groups: the app makes the id, see useCreateGroup.
      const id = crypto.randomUUID()
      const { error } = await supabase
        .from('attributes')
        .insert({ id, group_id: groupId, ...fields })
      if (error) throw error
      return id
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: attributeKeys.list(groupId) }),
  })
}

export function useUpdateAttribute(
  attribute: Pick<Attribute, 'id' | 'group_id'>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      fields: Partial<AttributeFields> & { archived_at?: string | null },
    ) => {
      const { data, error } = await supabase
        .from('attributes')
        .update(fields)
        .eq('id', attribute.id)
        .select('id')
      if (error) throw error
      // RLS turns a refused update into "no rows", not an error.
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attributeKeys.list(attribute.group_id),
      }),
  })
}

export function useDeleteAttribute(
  attribute: Pick<Attribute, 'id' | 'group_id'>,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('attributes')
        .delete()
        .eq('id', attribute.id)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: attributeKeys.list(attribute.group_id),
      }),
  })
}

// Saves a new order of the group's attributes. The list shows the new order
// straight away and goes back if saving fails.
export function useReorderAttributes(groupId: string) {
  const queryClient = useQueryClient()
  const key = attributeKeys.list(groupId)
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const { error } = await supabase.rpc('reorder_attributes', {
        target_group_id: groupId,
        attribute_ids: orderedIds,
      })
      if (error) throw error
    },
    onMutate: async (orderedIds) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<Attribute[]>(key)
      if (previous) {
        const position = new Map(orderedIds.map((id, index) => [id, index]))
        queryClient.setQueryData<Attribute[]>(
          key,
          [...previous].sort(
            (a, b) =>
              (position.get(a.id) ?? Infinity) -
                (position.get(b.id) ?? Infinity) || a.sort_order - b.sort_order,
          ),
        )
      }
      return { previous }
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
