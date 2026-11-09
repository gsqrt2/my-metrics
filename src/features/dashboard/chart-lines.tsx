import { cn } from 'cn'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts'

import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from '@/components/ui/chart'
import type { Attribute } from '@/features/attributes/use-attributes'
import {
  ageTickFormat,
  dateTickFormat,
  metricRows,
  participantRows,
  type ChartRow,
  type XMode,
  type YMode,
} from '@/features/dashboard/chart-data'
import { metricColors } from '@/features/dashboard/metric-colors'
import { formatPercent } from '@/features/dashboard/chart-format'
import type { SeriesPoint } from '@/features/dashboard/use-dashboard'
import { formatDateTime } from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { subjectColorVar } from '@/features/subjects/colors'
import type { Subject } from '@/features/subjects/use-subjects'

// Above this many points per line, plain points aren't drawn, only those with
// a comment, so dense lines stay readable.
const DOTS_UP_TO = 120

type Line = { key: string; name: string; color: string }

// The chart body shared by the small cards and the full-screen view.
function Lines({
  rows,
  lines,
  x,
  yFormat,
  tooltipValue,
  zeroLine,
  label,
  className,
}: {
  rows: ChartRow[]
  lines: Line[]
  x: XMode
  yFormat: (value: number) => string
  // The text after a line's name in the tooltip.
  tooltipValue: (row: ChartRow, line: Line) => string
  zeroLine: boolean
  label: string
  className?: string
}) {
  const config: ChartConfig = Object.fromEntries(
    lines.map((l) => [l.key, { label: l.name, color: l.color }]),
  )
  const xFormat = x === 'age' ? ageTickFormat() : dateTickFormat(rows)
  const showDots = rows.length <= DOTS_UP_TO

  return (
    <ChartContainer
      config={config}
      className={cn('aspect-auto w-full', className)}
      role="img"
      aria-label={label}
    >
      <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="x"
          type="number"
          scale={x === 'date' ? 'time' : 'linear'}
          // Ages run from one whole year to the next, so ticks land on years.
          domain={
            x === 'age'
              ? [
                  (min: number) => Math.floor(min),
                  (max: number) => Math.ceil(max),
                ]
              : ['dataMin', 'dataMax']
          }
          allowDecimals={x !== 'age'}
          tickFormatter={xFormat}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          domain={['auto', 'auto']}
          tickFormatter={yFormat}
          tickLine={false}
          axisLine={false}
          // As wide as its labels, so the chart lines up with the card's text.
          width="auto"
        />
        {zeroLine && (
          <ReferenceLine
            y={0}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}
        <ChartTooltip
          cursor={{ strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const row = payload[0].payload as ChartRow
            const first = lines.find((l) => row[l.key] != null)
            const time = first ? (row[`t:${first.key}`] as number) : null
            return (
              <div className="max-w-64 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
                {time !== null && (
                  <p className="mb-1 text-muted-foreground">
                    {formatDateTime(new Date(time).toISOString())}
                  </p>
                )}
                {lines
                  .filter((l) => row[l.key] != null)
                  .map((line) => {
                    const count = row[`n:${line.key}`] as number
                    const comment = row[`c:${line.key}`] as string | null
                    return (
                      <div key={line.key} className="py-0.5">
                        <p className="flex items-center gap-2">
                          <span
                            aria-hidden
                            className="size-2 shrink-0 rounded-full"
                            style={{ backgroundColor: line.color }}
                          />
                          <span>{line.name}</span>
                          <span className="ml-auto pl-3 font-medium tabular-nums">
                            {tooltipValue(row, line)}
                          </span>
                        </p>
                        {count > 1 && (
                          <p className="pl-4 text-muted-foreground">
                            average of {count} entries
                          </p>
                        )}
                        {comment && <p className="pl-4 italic">“{comment}”</p>}
                      </div>
                    )
                  })}
              </div>
            )
          }}
        />
        {lines.map((line) => (
          <Line
            key={line.key}
            dataKey={line.key}
            name={line.name}
            type="linear"
            stroke={line.color}
            strokeWidth={2}
            dot={(props: {
              cx?: number
              cy?: number
              payload?: ChartRow
              index?: number
            }) => {
              const { cx, cy, payload, index } = props
              const key = `${line.key}-${index}`
              const comment = payload?.[`c:${line.key}`]
              if (cx == null || cy == null || payload?.[line.key] == null) {
                return <g key={key} />
              }
              if (comment) {
                // A point with a comment: ringed, so it can be found (FR-61).
                return (
                  <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={4.5}
                    fill={line.color}
                    stroke="var(--foreground)"
                    strokeWidth={1.5}
                  />
                )
              }
              return showDots ? (
                <circle key={key} cx={cx} cy={cy} r={3} fill={line.color} />
              ) : (
                <g key={key} />
              )
            }}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}

// "By metric": one attribute, a line per subject in the subject's colour.
export function MetricLines({
  attribute,
  subjects,
  points,
  x = 'date',
  y = 'value',
  className,
}: {
  attribute: Attribute
  subjects: Subject[]
  points: SeriesPoint[]
  x?: XMode
  y?: YMode
  className?: string
}) {
  const rows = metricRows(points, attribute.id, subjects, x, y)
  const lines = subjects
    .filter((s) => rows.some((row) => row[s.id] != null))
    .map((s) => ({ key: s.id, name: s.name, color: subjectColorVar(s.color) }))
  const axisFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: attribute.precision,
    signDisplay: y === 'change' ? 'exceptZero' : 'auto',
  })
  const yFormat =
    y === 'pct' ? formatPercent : (v: number) => axisFormat.format(v)

  return (
    <Lines
      rows={rows}
      lines={lines}
      x={x}
      yFormat={yFormat}
      zeroLine={y !== 'value'}
      label={`${attribute.name} over ${x === 'age' ? 'age' : 'time'} for ${lines.map((l) => l.name).join(', ')}`}
      className={className}
      tooltipValue={(row, line) => {
        const value = row[`v:${line.key}`] as number | null
        const plotted = row[line.key] as number
        if (y === 'pct') {
          return value === null
            ? formatPercent(plotted)
            : `${formatValue(value, attribute)} · ${formatPercent(plotted)}`
        }
        if (y === 'change') {
          const sign = plotted > 0 ? '+' : plotted < 0 ? '−' : '±'
          const change = `${sign}${formatValue(Math.abs(plotted), attribute)}`
          return value === null
            ? change
            : `${formatValue(value, attribute)} · ${change}`
        }
        return formatValue(plotted, attribute)
      }}
    />
  )
}

// "By participant": one subject, a line per attribute as % change, in the
// attributes' palette colours (see metricColors).
export function ParticipantLines({
  subject,
  attributes,
  points,
  x = 'date',
  className,
}: {
  subject: Subject
  attributes: Attribute[]
  points: SeriesPoint[]
  x?: XMode
  className?: string
}) {
  const colors = metricColors(attributes.map((a) => a.id))
  const shown = attributes.filter((a) => colors.has(a.id))
  const rows = participantRows(
    points,
    subject,
    shown.map((a) => a.id),
    x,
  )
  const lines = shown
    .filter((a) => rows.some((row) => row[a.id] != null))
    .map((a) => ({
      key: a.id,
      name: a.name,
      color: subjectColorVar(colors.get(a.id)!),
    }))
  const byId = new Map(shown.map((a) => [a.id, a]))

  return (
    <Lines
      rows={rows}
      lines={lines}
      x={x}
      yFormat={formatPercent}
      zeroLine
      label={`${subject.name}: change since the first entry of ${lines.map((l) => l.name).join(', ')}`}
      className={className}
      tooltipValue={(row, line) => {
        const value = row[`v:${line.key}`] as number | null
        const pct = formatPercent(row[line.key] as number)
        return value === null
          ? pct
          : `${formatValue(value, byId.get(line.key)!)} · ${pct}`
      }}
    />
  )
}
