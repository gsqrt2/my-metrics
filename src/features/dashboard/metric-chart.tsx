import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import { attributeLabel } from '@/features/attributes/format'
import type { Attribute } from '@/features/attributes/use-attributes'
import { chartRows, dateTickFormat } from '@/features/dashboard/chart-data'
import type {
  DashboardRow,
  SeriesPoint,
} from '@/features/dashboard/use-dashboard'
import { formatDateTime } from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { subjectColorVar } from '@/features/subjects/colors'
import type { Subject } from '@/features/subjects/use-subjects'
import { formatDecimal } from '@/lib/numbers'

// One attribute's chart: a line per subject, sharing one unit and scale
// (FR-60, decided 2026-11-09), with each subject's latest value and changes
// below it, which also serve as the legend.
export function MetricChart({
  attribute,
  subjects,
  points,
  summary,
}: {
  attribute: Attribute
  subjects: Subject[]
  points: SeriesPoint[]
  summary: DashboardRow[]
}) {
  const rows = chartRows(
    points,
    attribute.id,
    subjects.map((s) => s.id),
  )
  const withData = subjects.filter((s) =>
    summary.some(
      (r) => r.subject_id === s.id && r.attribute_id === attribute.id,
    ),
  )
  const config: ChartConfig = Object.fromEntries(
    subjects.map((s) => [
      s.id,
      { label: s.name, color: subjectColorVar(s.color) },
    ]),
  )
  const label = attributeLabel(attribute)
  const tick = dateTickFormat(rows)
  // Axis ticks may fall between whole numbers, so they get up to the
  // attribute's decimals, without trailing zeros.
  const axisFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: attribute.precision,
  })
  const axisNumber = (value: number) => axisFormat.format(value)
  const number = (value: number) => formatDecimal(value, attribute.precision)

  return (
    <article
      aria-label={label}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <h3 className="font-heading font-semibold">{label}</h3>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <ChartContainer
          config={config}
          className="aspect-auto h-48 w-full"
          role="img"
          aria-label={`${label} over time for ${withData.map((s) => s.name).join(', ')}`}
        >
          <LineChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
          >
            <CartesianGrid vertical={false} strokeDasharray="0" />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              tickFormatter={tick}
              tickLine={false}
              axisLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tickFormatter={axisNumber}
              allowDecimals={attribute.precision > 0}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <ChartTooltip
              cursor={{ strokeWidth: 1 }}
              content={({ active, payload, label: t }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                    <p className="mb-1 text-muted-foreground">
                      {formatDateTime(new Date(Number(t)).toISOString())}
                    </p>
                    {payload.map((item) => {
                      const subject = subjects.find(
                        (s) => s.id === item.dataKey,
                      )
                      return subject ? (
                        <p key={subject.id} className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: subjectColorVar(subject.color),
                            }}
                          />
                          <span>{subject.name}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums">
                            {formatValue(Number(item.value), attribute)}
                          </span>
                        </p>
                      ) : null
                    })}
                  </div>
                ) : null
              }
            />
            {subjects.map((subject) => (
              <Line
                key={subject.id}
                dataKey={subject.id}
                name={subject.name}
                type="linear"
                stroke={subjectColorVar(subject.color)}
                strokeWidth={2}
                dot={{
                  r: 3,
                  strokeWidth: 0,
                  fill: subjectColorVar(subject.color),
                }}
                activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}

      {withData.length > 0 && (
        <ul
          aria-label={`${attribute.name}: latest values`}
          className="flex flex-col gap-2"
        >
          {withData.map((subject) => {
            const row = summary.find(
              (r) =>
                r.subject_id === subject.id && r.attribute_id === attribute.id,
            )!
            return (
              <li
                key={subject.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 self-center rounded-full"
                    style={{ backgroundColor: subjectColorVar(subject.color) }}
                  />
                  <span className="truncate">{subject.name}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {row.latest_value === null
                    ? 'hidden'
                    : formatValue(row.latest_value, attribute)}
                </span>
                <Change
                  label="since last"
                  change={row.change_since_previous}
                  unit={attribute.unit}
                  number={number}
                />
                <Change
                  label="since first"
                  change={row.entry_count > 1 ? row.change_since_first : null}
                  unit={attribute.unit}
                  number={number}
                />
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

// A change, shown objectively: arrow and sign, no judgement (decided
// 2026-11-09: tracking only).
export function Change({
  label,
  change,
  unit,
  number,
}: {
  label: string
  change: number | null
  unit: string | null
  number: (value: number) => string
}) {
  if (change === null) return null
  const Icon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus
  const sign = change > 0 ? '+' : change < 0 ? '−' : '±'
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground tabular-nums">
      <Icon className="size-3" aria-hidden />
      {sign}
      {number(Math.abs(change))}
      {unit ? ` ${unit}` : ''} {label}
    </span>
  )
}
