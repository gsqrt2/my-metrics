import type { SeriesPoint } from '@/features/dashboard/use-dashboard'

// One chart's rows for Recharts: one row per moment, one column per subject
// (by id). Subjects measured at the same moment share a row; the lines join
// across moments a subject has no value for.
export type ChartRow = { t: number } & Record<string, number>

export function chartRows(
  points: Pick<
    SeriesPoint,
    'subject_id' | 'attribute_id' | 'measured_at' | 'value'
  >[],
  attributeId: string,
  subjectIds: string[],
): ChartRow[] {
  const shown = new Set(subjectIds)
  const rows = new Map<number, ChartRow>()
  for (const point of points) {
    if (point.attribute_id !== attributeId) continue
    if (!shown.has(point.subject_id) || point.value === null) continue
    const t = new Date(point.measured_at).getTime()
    const row = rows.get(t) ?? { t }
    row[point.subject_id] = point.value
    rows.set(t, row)
  }
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

// Axis dates: day and month for spans within a year, month and year beyond
// ("Nov 2025": a 2-digit year would read like a day).
export function dateTickFormat(rows: { t: number }[], locale?: string) {
  const span = rows.length > 1 ? rows[rows.length - 1].t - rows[0].t : 0
  const format = new Intl.DateTimeFormat(
    locale,
    span > 330 * 24 * 3600 * 1000
      ? { month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  )
  return (t: number) => format.format(new Date(t))
}

// A subject's rows for the "by participant" chart: one row per moment, one
// column per attribute with its % change since that attribute's first entry,
// and the actual value under "v:<attribute id>" for the tooltip (null if
// hidden from the viewer). Attributes whose first value is 0 have no % change
// and are left out; see attributesWithoutChange.
export type ChangeRow = { t: number } & Record<string, number | null>

export function changeRows(
  points: Pick<
    SeriesPoint,
    'subject_id' | 'attribute_id' | 'measured_at' | 'value' | 'pct_change'
  >[],
  subjectId: string,
  attributeIds: string[],
): ChangeRow[] {
  const shown = new Set(attributeIds)
  const rows = new Map<number, ChangeRow>()
  for (const point of points) {
    if (point.subject_id !== subjectId || !shown.has(point.attribute_id))
      continue
    if (point.pct_change === null) continue
    const t = new Date(point.measured_at).getTime()
    const row = rows.get(t) ?? { t }
    row[point.attribute_id] = point.pct_change
    row[`v:${point.attribute_id}`] = point.value
    rows.set(t, row)
  }
  return [...rows.values()].sort((a, b) => a.t - b.t)
}

// Attributes a subject has entries for, but no % change (first value 0).
export function attributesWithoutChange(
  points: Pick<SeriesPoint, 'subject_id' | 'attribute_id' | 'pct_change'>[],
  subjectId: string,
  attributeIds: string[],
): string[] {
  const logged = new Set<string>()
  const withChange = new Set<string>()
  for (const point of points) {
    if (point.subject_id !== subjectId) continue
    logged.add(point.attribute_id)
    if (point.pct_change !== null) withChange.add(point.attribute_id)
  }
  return attributeIds.filter((id) => logged.has(id) && !withChange.has(id))
}
