import { parseISO, startOfDay, subDays, subMonths, subYears } from 'date-fns'

import type { SeriesPoint } from '@/features/dashboard/use-dashboard'

// Chart rows for Recharts: one row per x position, one column per line (a
// subject in "by metric", an attribute in "by participant") with the plotted
// number, plus per line, for the tooltip and point markers:
//   v:<line>  the actual value (null if hidden from the viewer)
//   n:<line>  how many entries the point averages
//   c:<line>  the comment of a single entry
//   t:<line>  the time of the point
export type ChartRow = { x: number } & Record<string, number | string | null>

export type XMode = 'date' | 'age'
export type YMode = 'value' | 'change' | 'pct'

const YEAR_MS = 365.25 * 24 * 3600 * 1000

// Where a point sits on the x-axis: its time, or the subject's age in years
// when it was measured (FR-63).
export function xOf(measuredAt: string, x: XMode, birthdate: string | null) {
  const t = new Date(measuredAt).getTime()
  if (x === 'date' || !birthdate) return t
  return (t - parseISO(birthdate).getTime()) / YEAR_MS
}

function yOf(point: SeriesPoint, y: YMode) {
  return y === 'value'
    ? point.value
    : y === 'change'
      ? point.change
      : point.pct_change
}

function addPoint(
  rows: Map<number, ChartRow>,
  key: number,
  line: string,
  plotted: number,
  point: SeriesPoint,
) {
  const row = rows.get(key) ?? { x: key }
  row[line] = plotted
  row[`v:${line}`] = point.value
  row[`n:${line}`] = point.entry_count
  row[`c:${line}`] = point.comment
  row[`t:${line}`] = new Date(point.measured_at).getTime()
  rows.set(key, row)
}

const sorted = (rows: Map<number, ChartRow>) =>
  [...rows.values()].sort((a, b) => a.x - b.x)

// "By metric": a line per subject for one attribute.
export function metricRows(
  points: SeriesPoint[],
  attributeId: string,
  subjects: { id: string; birthdate: string | null }[],
  x: XMode = 'date',
  y: YMode = 'value',
): ChartRow[] {
  const birthdates = new Map(subjects.map((s) => [s.id, s.birthdate]))
  const rows = new Map<number, ChartRow>()
  for (const point of points) {
    if (point.attribute_id !== attributeId) continue
    if (!birthdates.has(point.subject_id)) continue
    const plotted = yOf(point, y)
    if (plotted === null) continue
    const key = xOf(point.measured_at, x, birthdates.get(point.subject_id)!)
    addPoint(rows, key, point.subject_id, plotted, point)
  }
  return sorted(rows)
}

// "By participant": a line per attribute for one subject, as % change since
// the baseline. Attributes without a % change (first value 0) are left out;
// see attributesWithoutChange.
export function participantRows(
  points: SeriesPoint[],
  subject: { id: string; birthdate: string | null },
  attributeIds: string[],
  x: XMode = 'date',
): ChartRow[] {
  const shown = new Set(attributeIds)
  const rows = new Map<number, ChartRow>()
  for (const point of points) {
    if (point.subject_id !== subject.id) continue
    if (!shown.has(point.attribute_id) || point.pct_change === null) continue
    const key = xOf(point.measured_at, x, subject.birthdate)
    addPoint(rows, key, point.attribute_id, point.pct_change, point)
  }
  return sorted(rows)
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

// Axis dates: day and month for spans within a year, month and year beyond
// ("Nov 2025": a 2-digit year would read like a day).
export function dateTickFormat(rows: { x: number }[], locale?: string) {
  const span = rows.length > 1 ? rows[rows.length - 1].x - rows[0].x : 0
  const format = new Intl.DateTimeFormat(
    locale,
    span > 330 * 24 * 3600 * 1000
      ? { month: 'short', year: 'numeric' }
      : { day: 'numeric', month: 'short' },
  )
  return (t: number) => format.format(new Date(t))
}

// Axis ages in whole years, e.g. "3 yrs".
export function ageTickFormat(locale?: string) {
  const format = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'year',
    unitDisplay: 'short',
    maximumFractionDigits: 0,
  })
  return (years: number) => format.format(years)
}

// FR-64 time spans for the full-screen charts. (A "Duration" span for groups
// with dates was dropped on 2026-11-09: entries rarely fall outside the
// dates, so it showed the same as "All".)
export type Period = 'week' | 'month' | 'year' | 'all'

export function periodRange(
  period: Period,
  now = new Date(),
): { from?: Date; to?: Date } {
  switch (period) {
    case 'week':
      return { from: startOfDay(subDays(now, 6)) }
    case 'month':
      return { from: startOfDay(subMonths(now, 1)) }
    case 'year':
      return { from: startOfDay(subYears(now, 1)) }
    case 'all':
      return {}
  }
}

// How many points a full-screen line may have: about one per 3 pixels of
// width, between the small charts' 100 and 500.
export function fullScreenMaxPoints(width: number) {
  return Math.min(500, Math.max(100, Math.round(width / 3)))
}

export const SMALL_CHART_MAX_POINTS = 100
