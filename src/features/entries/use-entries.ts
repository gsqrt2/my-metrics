import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

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

// Everything logged for a subject at one moment (values logged together share
// subject and time, FR-51), as far as the viewer may see it.
export function useEntryMoment(subjectId: string, measuredAt: string) {
  return useQuery({
    queryKey: [...entryKeys.all, 'moment', subjectId, measuredAt],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('entries')
        .select(ENTRY_COLUMNS)
        .eq('subject_id', subjectId)
        .eq('measured_at', measuredAt)
        .overrideTypes<Entry[], { merge: false }>()
      if (error) throw error
      return data
    },
  })
}

export type MomentChanges = {
  measuredAt: string
  comment: string
  // attribute id → new value, or null to delete its entry
  values: Record<string, number | null>
}

// Saves an edited moment in one transaction (save_entry_moment): changed and
// new values, deleted ones, and the time and comment for all.
export function useSaveEntryMoment(
  subjectId: string,
  measuredAtBefore: string,
) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (changes: MomentChanges) => {
      const { error } = await supabase.rpc('save_entry_moment', {
        target_subject_id: subjectId,
        measured_at_before: measuredAtBefore,
        new_measured_at: changes.measuredAt,
        new_comment: changes.comment,
        new_values: changes.values,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: entryKeys.all })
      queryClient.invalidateQueries({ queryKey: ['attribute-entry-count'] })
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

// How many entries an attribute has, for the warnings on editing and
// deleting it (FR-41, FR-42), hidden ones included.
export function useAttributeEntryCount(attributeId: string) {
  return useQuery({
    queryKey: ['attribute-entry-count', attributeId],
    queryFn: async () => {
      // Through the database, so entries hidden from the viewer (FR-43)
      // count too, as a number only.
      const { data, error } = await supabase.rpc('attribute_entry_count', {
        target_attribute_id: attributeId,
      })
      if (error) throw error
      return data ?? 0
    },
  })
}
