import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import type { SubjectColor } from '@/features/subjects/colors'
import { supabase } from '@/lib/supabase'
import type { Tables } from '@/types/database'

export type Entry = Pick<
  Tables<'entries'>,
  'id' | 'value' | 'measured_at' | 'comment' | 'created_at' | 'updated_at'
> & {
  subject: {
    id: string
    name: string
    color: SubjectColor
    group_id: string
    linked_user_id: string | null
    archived_at: string | null
  }
  attribute: Pick<
    Tables<'attributes'>,
    | 'id'
    | 'name'
    | 'unit'
    | 'precision'
    | 'min_value'
    | 'max_value'
    | 'archived_at'
  >
  creator: { display_name: string } | null
  updater: { display_name: string } | null
}

const ENTRY_COLUMNS = `
  id, value, measured_at, comment, created_at, updated_at,
  subject:subjects!inner(id, name, color, group_id, linked_user_id, archived_at),
  attribute:attributes!inner(id, name, unit, precision, min_value, max_value, archived_at),
  creator:profiles!entries_created_by_fkey(display_name),
  updater:profiles!entries_updated_by_fkey(display_name)
`

export const RECENT_ENTRIES_LIMIT = 50

export const entryKeys = {
  all: ['entries'] as const,
  recent: (groupId: string) => ['entries', 'recent', groupId] as const,
  detail: (entryId: string) => ['entries', 'detail', entryId] as const,
}

// A group's latest entries, newest first. Step 8 adds the full table.
export function useRecentEntries(groupId: string) {
  return useQuery({
    queryKey: entryKeys.recent(groupId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(ENTRY_COLUMNS)
        .eq('subject.group_id', groupId)
        .order('measured_at', { ascending: false })
        .limit(RECENT_ENTRIES_LIMIT)
        .overrideTypes<Entry[], { merge: false }>()
      if (error) throw error
      return data
    },
  })
}

export type EntrySort = 'newest' | 'oldest' | 'highest' | 'lowest'
export const ENTRIES_PAGE_SIZE = 50

// FR-65: a page of a group's entries, filtered by subject and attribute and
// sorted, with the total count for paging.
export function useEntryTable(
  groupId: string,
  options: {
    subjectId?: string
    attributeId?: string
    sort: EntrySort
    page: number
  },
) {
  return useQuery({
    queryKey: [...entryKeys.all, 'table', groupId, options] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase
        .from('entries')
        .select(ENTRY_COLUMNS, { count: 'exact' })
        .eq('subject.group_id', groupId)
      if (options.subjectId) query = query.eq('subject_id', options.subjectId)
      if (options.attributeId) {
        query = query.eq('attribute_id', options.attributeId)
      }
      const byValue = options.sort === 'highest' || options.sort === 'lowest'
      query = byValue
        ? query
            .order('value', { ascending: options.sort === 'lowest' })
            .order('measured_at', { ascending: false })
        : query.order('measured_at', { ascending: options.sort === 'oldest' })
      const from = options.page * ENTRIES_PAGE_SIZE
      const { data, error, count } = await query
        .range(from, from + ENTRIES_PAGE_SIZE - 1)
        .overrideTypes<Entry[], { merge: false }>()
      if (error) throw error
      return { entries: data, total: count ?? 0 }
    },
  })
}

export function useEntry(entryId: string) {
  return useQuery({
    queryKey: entryKeys.detail(entryId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(ENTRY_COLUMNS)
        .eq('id', entryId)
        .overrideTypes<Entry[], { merge: false }>()
      if (error) throw error
      return data[0] ?? null
    },
  })
}

export type NewEntry = Pick<
  Tables<'entries'>,
  'subject_id' | 'attribute_id' | 'value' | 'measured_at' | 'comment'
>

// FR-51: several values in one statement, so all are saved or none is.
export function useLogEntries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entries: NewEntry[]) => {
      const { error } = await supabase.from('entries').insert(entries)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['attribute-entry-count'] })
    },
  })
}

export function useUpdateEntry(entryId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (
      fields: Pick<Tables<'entries'>, 'value' | 'measured_at' | 'comment'>,
    ) => {
      const { data, error } = await supabase
        .from('entries')
        .update(fields)
        .eq('id', entryId)
        .select('id')
      if (error) throw error
      // RLS turns a refused update into "no rows", not an error.
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: entryKeys.all }),
  })
}

export function useDeleteEntry(entryId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .delete()
        .eq('id', entryId)
        .select('id')
      if (error) throw error
      if (data.length === 0) throw new Error('not_allowed')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['attribute-entry-count'] })
    },
  })
}

// How many entries an attribute has, for the warnings on editing and
// deleting it (FR-41, FR-42). Counts the entries the user can see.
export function useAttributeEntryCount(attributeId: string) {
  return useQuery({
    queryKey: ['attribute-entry-count', attributeId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('entries')
        .select('id', { count: 'exact', head: true })
        .eq('attribute_id', attributeId)
      if (error) throw error
      return count ?? 0
    },
  })
}
