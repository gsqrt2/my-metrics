import { keepPreviousData, useQuery } from '@tanstack/react-query'

import {
  useAttributes,
  type Attribute,
} from '@/features/attributes/use-attributes'
import { entryKeys } from '@/features/entries/use-entries'
import { useSubjects, type Subject } from '@/features/subjects/use-subjects'
import { supabase } from '@/lib/supabase'

export type EntrySort = 'newest' | 'oldest' | 'highest' | 'lowest'
export const ENTRIES_PAGE_SIZE = 50

// An entry as the lists show it. value is null when its owner shows the
// others only the % change (FR-43); pct_change is null when the first value
// was 0 ("n/a").
export type EntryRow = {
  id: string
  measured_at: string
  value: number | null
  pct_change: number | null
  comment: string | null
  creator_name: string | null
  subject: Subject
  attribute: Attribute
}

type RawRow = {
  entry_id: string
  subject_id: string
  attribute_id: string
  measured_at: string
  value: number | null
  pct_change: number | null
  comment: string | null
  creator_name: string | null
  total_count: number
}

// FR-65, FR-66 through get_entry_rows, which gives hidden values only as %
// so they still appear in the lists. Subjects and attributes come from their
// own (cached) queries.
export function useEntryRows(
  groupId: string,
  options: {
    subjectId?: string
    attributeId?: string
    sort: EntrySort
    pageSize: number
    page: number
  },
) {
  const subjects = useSubjects(groupId)
  const attributes = useAttributes(groupId)
  const rows = useQuery({
    queryKey: [...entryKeys.all, 'rows', groupId, options] as const,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_entry_rows', {
        target_group_id: groupId,
        subject_filter: options.subjectId,
        attribute_filter: options.attributeId,
        sort: options.sort,
        page_size: options.pageSize,
        page_offset: options.page * options.pageSize,
      })
      if (error) throw error
      return data as unknown as RawRow[]
    },
  })

  const ready = rows.data && subjects.data && attributes.data
  const data = ready
    ? {
        total: rows.data![0]?.total_count ?? 0,
        entries: rows.data!.flatMap((row) => {
          const subject = subjects.data!.find((s) => s.id === row.subject_id)
          const attribute = attributes.data!.find(
            (a) => a.id === row.attribute_id,
          )
          if (!subject || !attribute) return []
          return [
            {
              id: row.entry_id,
              measured_at: row.measured_at,
              value: row.value,
              pct_change: row.pct_change,
              comment: row.comment,
              creator_name: row.creator_name,
              subject,
              attribute,
            } satisfies EntryRow,
          ]
        }),
      }
    : undefined

  return {
    data,
    isPending:
      !data && !(rows.isError || subjects.isError || attributes.isError),
    isError: rows.isError || subjects.isError || attributes.isError,
  }
}
