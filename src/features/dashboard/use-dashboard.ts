import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

type Functions = Database['public']['Functions']
type GeneratedPoint = Functions['get_series']['Returns'][number]
type GeneratedRow = Functions['get_dashboard']['Returns'][number]

// The generated types can't tell which columns a function may leave empty.
// These can be: values hidden from the viewer (FR-43), % changes against a
// baseline of 0, ids and comments of grouped points, and "previous" values
// when there's only one entry.
export type SeriesPoint = Omit<
  GeneratedPoint,
  'value' | 'change' | 'pct_change' | 'entry_id' | 'comment'
> & {
  value: number | null
  change: number | null
  pct_change: number | null
  entry_id: string | null
  comment: string | null
}

export type DashboardRow = {
  [K in keyof GeneratedRow]: K extends
    'subject_id' | 'attribute_id' | 'entry_count' | 'first_at' | 'latest_at'
    ? GeneratedRow[K]
    : GeneratedRow[K] | null
}

export type Baseline = 'first' | 'group_start'

export type SeriesOptions = {
  from?: Date
  to?: Date
  maxPoints?: number
  baseline?: Baseline
}

// Entries change these too, so they live under the entries keys.
export const dashboardKeys = {
  series: (groupId: string, options: SeriesOptions) =>
    [
      'entries',
      'series',
      groupId,
      options.from?.toISOString() ?? null,
      options.to?.toISOString() ?? null,
      options.maxPoints ?? null,
      options.baseline ?? 'first',
    ] as const,
  summary: (groupId: string) => ['entries', 'dashboard', groupId] as const,
}

// A group's entries for its charts (FR-60 – FR-64), grouped by the database
// when there are more than maxPoints per line. Keeps showing the previous
// result while another period loads, so charts don't flash empty.
export function useSeries(groupId: string, options: SeriesOptions = {}) {
  return useQuery({
    queryKey: dashboardKeys.series(groupId, options),
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_series', {
        target_group_id: groupId,
        from_at: options.from?.toISOString(),
        to_at: options.to?.toISOString(),
        max_points: options.maxPoints,
        baseline: options.baseline ?? 'first',
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
