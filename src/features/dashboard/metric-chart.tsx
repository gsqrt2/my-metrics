import { ArrowDown, ArrowUp, Maximize2, Minus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { attributeLabel } from '@/features/attributes/format'
import type { Attribute } from '@/features/attributes/use-attributes'
import { hasHiddenValues } from '@/features/dashboard/chart-data'
import { MetricLines } from '@/features/dashboard/chart-lines'
import { EntryValue } from '@/features/entries/entry-value'
import type {
  DashboardRow,
  SeriesPoint,
} from '@/features/dashboard/use-dashboard'
import { formatValue } from '@/features/entries/format'
import { subjectColorVar } from '@/features/subjects/colors'
import type { Subject } from '@/features/subjects/use-subjects'
import { formatDecimal } from '@/lib/numbers'

// One attribute's card in the "by metric" view: a line per subject, in real
// values, with each subject's latest value and changes below (also the
// legend). The button in its title opens it full screen; the chart itself
// only shows tooltips.
export function MetricChart({
  attribute,
  subjects,
  points,
  summary,
  onOpen,
}: {
  attribute: Attribute
  subjects: Subject[]
  points: SeriesPoint[]
  summary: DashboardRow[]
  onOpen: () => void
}) {
  const label = attributeLabel(attribute)
  const withData = subjects.filter((s) =>
    summary.some(
      (r) => r.subject_id === s.id && r.attribute_id === attribute.id,
    ),
  )
  const number = (value: number) => formatDecimal(value, attribute.precision)
  const hidden = hasHiddenValues(
    points,
    attribute.id,
    subjects.map((s) => s.id),
  )

  return (
    <ChartCard title={<>{label}</>} label={label} onOpen={onOpen}>
      {withData.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <>
          <MetricLines
            attribute={attribute}
            subjects={subjects}
            points={points}
            y={hidden ? 'pct' : 'value'}
            className="h-48"
          />
          {hidden && (
            <p className="-mt-2 text-xs text-muted-foreground">
              Shown as % change since the first entry, because some participants
              keep their values here private.
            </p>
          )}
          <ul
            aria-label={`${attribute.name}: latest values`}
            className="flex flex-col gap-2"
          >
            {withData.map((subject) => {
              const row = summary.find(
                (r) =>
                  r.subject_id === subject.id &&
                  r.attribute_id === attribute.id,
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
                      style={{
                        backgroundColor: subjectColorVar(subject.color),
                      }}
                    />
                    <span className="truncate">{subject.name}</span>
                  </span>
                  {row.latest_value === null ? (
                    // Private (FR-43): only the change since the first entry.
                    <>
                      <EntryValue
                        value={null}
                        pctChange={row.pct_since_first}
                        attribute={attribute}
                      />
                      <span className="text-xs text-muted-foreground">
                        since first
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium tabular-nums">
                        {formatValue(row.latest_value, attribute)}
                      </span>
                      <Change
                        label="since last"
                        change={row.change_since_previous}
                        unit={attribute.unit}
                        number={number}
                      />
                      <Change
                        label="since first"
                        change={
                          row.entry_count > 1 ? row.change_since_first : null
                        }
                        unit={attribute.unit}
                        number={number}
                      />
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </ChartCard>
  )
}

// The frame of a chart card: its title with a button to open the chart full
// screen (FR-61).
export function ChartCard({
  title,
  label,
  onOpen,
  children,
}: {
  title: React.ReactNode
  label: string
  onOpen: () => void
  children: React.ReactNode
}) {
  return (
    <article
      aria-label={label}
      className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex min-w-0 items-center gap-2 font-heading font-semibold">
          {title}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Open ${label} full screen`}
          onClick={onOpen}
        >
          <Maximize2 aria-hidden />
        </Button>
      </div>
      {children}
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
