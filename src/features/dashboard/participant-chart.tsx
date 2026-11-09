import type { Attribute } from '@/features/attributes/use-attributes'
import { attributesWithoutChange } from '@/features/dashboard/chart-data'
import { formatPercent } from '@/features/dashboard/chart-format'
import { ParticipantLines } from '@/features/dashboard/chart-lines'
import { ChartCard } from '@/features/dashboard/metric-chart'
import {
  MAX_METRICS_PER_CHART,
  metricColors,
} from '@/features/dashboard/metric-colors'
import type {
  DashboardRow,
  SeriesPoint,
} from '@/features/dashboard/use-dashboard'
import { formatValue } from '@/features/entries/format'
import { subjectColorVar } from '@/features/subjects/colors'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import type { Subject } from '@/features/subjects/use-subjects'

// One subject's card in the "by participant" view (decided 2026-11-09):
// every attribute as its % change since its first entry, so different units
// can share one axis. Actual values with units show on hover and in the list
// below (also the legend). The button in its title opens it full screen.
export function ParticipantChart({
  subject,
  attributes,
  points,
  summary,
  onOpen,
}: {
  subject: Subject
  attributes: Attribute[]
  points: SeriesPoint[]
  summary: DashboardRow[]
  onOpen: () => void
}) {
  const shown = attributes.slice(0, MAX_METRICS_PER_CHART)
  const ids = shown.map((a) => a.id)
  const colors = metricColors(ids)
  const noChange = new Set(attributesWithoutChange(points, subject.id, ids))
  const latest = shown
    .map((attribute) => ({
      attribute,
      row: summary.find(
        (r) => r.subject_id === subject.id && r.attribute_id === attribute.id,
      ),
    }))
    .filter((item) => item.row !== undefined)

  return (
    <ChartCard
      label={subject.name}
      onOpen={onOpen}
      title={
        <>
          <SubjectAvatar
            name={subject.name}
            color={subject.color}
            className="size-6 text-[0.625rem]"
          />
          <span className="truncate">{subject.name}</span>
        </>
      }
    >
      {latest.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing logged yet.
        </p>
      ) : (
        <>
          <ParticipantLines
            subject={subject}
            attributes={shown}
            points={points}
            className="h-48"
          />
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
    </ChartCard>
  )
}
