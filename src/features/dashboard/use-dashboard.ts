import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Functions = Database['public']['Functions']
type GeneratedPoint = Functions['get_series']['Returns'][number]
type GeneratedRow = Functions['get_dashboard']['Returns'][number]

// The generated types can't tell which columns a function may leave empty.
// These can be: values hidden from the viewer (FR-43), % changes against a
// first value of 0, and "previous" values when there's only one entry.
export type SeriesPoint = Omit<
  GeneratedPoint,
  'value' | 'pct_change' | 'comment'
> & { value: number | null; pct_change: number | null; comment: string | null }

export type DashboardRow = {
  [K in keyof GeneratedRow]: K extends
    'subject_id' | 'attribute_id' | 'entry_count' | 'first_at' | 'latest_at'
    ? GeneratedRow[K]
    : GeneratedRow[K] | null
}

// Entries change these too, so they live under the entries keys.
export const dashboardKeys = {
  series: (groupId: string) => ['entries', 'series', groupId] as const,
  summary: (groupId: string) => ['entries', 'dashboard', groupId] as const,
}

// Every entry of a group, oldest first, for its charts (FR-60). Step 8 adds
// time spans; until then charts show all entries.
export function useSeries(groupId: string) {
  return useQuery({
    queryKey: dashboardKeys.series(groupId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_series', {
        target_group_id: groupId,
      })
      if (error) throw error
      return data as SeriesPoint[]
    },
  })
}

// First, previous and latest entry per subject and attribute (FR-60).
export function useDashboard(groupId: string) {
  return useQuery({
    queryKey: dashboardKeys.summary(groupId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_dashboard', {
        target_group_id: groupId,
      })
      if (error) throw error
      return data as DashboardRow[]
    },
  })
}
