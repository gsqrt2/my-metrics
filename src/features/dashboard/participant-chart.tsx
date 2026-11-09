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
  attributesWithoutChange,
  changeRows,
  dateTickFormat,
} from '@/features/dashboard/chart-data'
import { Change } from '@/features/dashboard/metric-chart'
import {
  MAX_METRICS_PER_CHART,
  metricColors,
} from '@/features/dashboard/metric-colors'
import type {
  DashboardRow,
  SeriesPoint,
} from '@/features/dashboard/use-dashboard'
import { formatDateTime } from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { subjectColorVar } from '@/features/subjects/colors'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import type { Subject } from '@/features/subjects/use-subjects'

const percent = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  signDisplay: 'exceptZero',
})
const formatPercent = (value: number) => `${percent.format(value)}%`

// One subject's chart in the "by participant" view (decided 2026-11-09):
// every attribute as its % change since its first entry, so different units
// can share one axis. The actual values, with units, show on hover and in
// the list below, which is also the legend.
export function ParticipantChart({
  subject,
  attributes,
  points,
  summary,
}: {
  subject: Subject
  attributes: Attribute[]
  points: SeriesPoint[]
  summary: DashboardRow[]
}) {
  const shown = attributes.slice(0, MAX_METRICS_PER_CHART)
  const ids = shown.map((a) => a.id)
  const colors = metricColors(ids)
  const rows = changeRows(points, subject.id, ids)
  const noChange = new Set(attributesWithoutChange(points, subject.id, ids))
  const lines = shown.filter(
    (a) => !noChange.has(a.id) && rows.some((row) => row[a.id] != null),
  )
  const latest = shown
    .map((attribute) => ({
      attribute,
      row: summary.find(
        (r) => r.subject_id === subject.id && r.attribute_id === attribute.id,
      ),
    }))
    .filter((item) => item.row !== undefined)
  const config: ChartConfig = Object.fromEntries(
    shown.map((a) => [
      a.id,
      { label: a.name, color: subjectColorVar(colors.get(a.id)!) },
    ]),
  )
  const tick = dateTickFormat(rows)

  return (
    <article
      aria-label={subject.name}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <h3 className="flex items-center gap-2 font-heading font-semibold">
        <SubjectAvatar
          name={subject.name}
          color={subject.color}
          className="size-6 text-[0.625rem]"
        />
        {subject.name}
      </h3>

      {latest.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <>
          {lines.length > 0 && (
            <ChartContainer
              config={config}
              className="aspect-auto h-48 w-full"
              role="img"
              aria-label={`${subject.name}: change since the first entry of ${lines.map((a) => a.name).join(', ')}`}
            >
              <LineChart
                data={rows}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} />
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
                  tickFormatter={formatPercent}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                {/* The baseline: every line starts here. */}
                <ReferenceLine
                  y={0}
                  stroke="var(--muted-foreground)"
                  strokeWidth={1}
                  strokeDasharray="4 3"
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
                          const attribute = lines.find(
                            (a) => a.id === item.dataKey,
                          )
                          if (!attribute) return null
                          const value = (
                            item.payload as Record<string, number | null>
                          )[`v:${attribute.id}`]
                          return (
                            <p
                              key={attribute.id}
                              className="flex items-center gap-2"
                            >
                              <span
                                aria-hidden
                                className="size-2 rounded-full"
                                style={{
                                  backgroundColor: subjectColorVar(
                                    colors.get(attribute.id)!,
                                  ),
                                }}
                              />
                              <span>{attribute.name}</span>
                              <span className="ml-auto pl-3 font-medium tabular-nums">
                                {value != null &&
                                  `${formatValue(value, attribute)} · `}
                                {formatPercent(Number(item.value))}
                              </span>
                            </p>
                          )
                        })}
                      </div>
                    ) : null
                  }
                />
                {lines.map((attribute) => (
                  <Line
                    key={attribute.id}
                    dataKey={attribute.id}
                    name={attribute.name}
                    type="linear"
                    stroke={subjectColorVar(colors.get(attribute.id)!)}
                    strokeWidth={2}
                    dot={{
                      r: 3,
                      strokeWidth: 0,
                      fill: subjectColorVar(colors.get(attribute.id)!),
                    }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)' }}
                    connectNulls
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ChartContainer>
          )}

          <ul
            aria-label={`${subject.name}: latest values`}
            className="flex flex-col gap-2"
          >
            {latest.map(({ attribute, row }) => (
              <li
                key={attribute.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-sm"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 shrink-0 self-center rounded-full"
                    style={{
                      backgroundColor: subjectColorVar(
                        colors.get(attribute.id)!,
                      ),
                    }}
                  />
                  <span className="truncate">{attribute.name}</span>
                </span>
                <span className="font-medium tabular-nums">
                  {row!.latest_value === null
                    ? 'hidden'
                    : formatValue(row!.latest_value, attribute)}
                </span>
                {row!.entry_count > 1 && row!.pct_since_first !== null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(row!.pct_since_first)} since first
                  </span>
                )}
                {row!.entry_count > 1 && row!.pct_since_first === null && (
                  <Change
                    label="since first"
                    change={row!.change_since_first}
                    unit={attribute.unit}
                    number={(v) => formatValue(v, { ...attribute, unit: null })}
                  />
                )}
              </li>
            ))}
          </ul>

          {noChange.size > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in the chart:{' '}
              {shown
                .filter((a) => noChange.has(a.id))
                .map((a) => a.name)
                .join(', ')}
              . A change in % can't be worked out when the first value is 0.
            </p>
          )}
          {attributes.length > MAX_METRICS_PER_CHART && (
            <p className="text-xs text-muted-foreground">
              Showing the first {MAX_METRICS_PER_CHART} of {attributes.length}{' '}
              metrics. Choose which ones above.
            </p>
          )}
        </>
      )}
    </article>
  )
}
