import { cn } from 'cn'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Attribute } from '@/features/attributes/use-attributes'
import type { ChartMode } from '@/features/dashboard/chart-mode'
import { MetricChart } from '@/features/dashboard/metric-chart'
import { ParticipantChart } from '@/features/dashboard/participant-chart'
import { useDashboard, useSeries } from '@/features/dashboard/use-dashboard'
import type { GroupRow } from '@/features/groups/types'
import type { Subject } from '@/features/subjects/use-subjects'

const modes: { value: ChartMode; label: string }[] = [
  { value: 'metric', label: 'By metric' },
  { value: 'participant', label: 'By participant' },
]

// FR-60: the group page's charts, in one of two views (decided 2026-11-09):
// - by metric: a chart per attribute with the chosen subjects, real values
// - by participant: a chart per subject with the chosen attributes, % change
// The chip rows above choose the subjects or the attributes.
export function ChartsSection({
  group,
  mode,
  onModeChange,
  canSwitch,
  subjects,
  attributes,
  hasAttributes,
}: {
  group: GroupRow
  mode: ChartMode
  onModeChange: (mode: ChartMode) => void
  // Only with more than one participant; with one, both views are the same.
  canSwitch: boolean
  // The ones chosen in the chip filters.
  subjects: Subject[]
  attributes: Attribute[]
  hasAttributes: boolean
}) {
  const series = useSeries(group.id)
  const summary = useDashboard(group.id)

  let body: React.ReactNode
  if (series.isError || summary.isError) {
    body = (
      <Alert variant="destructive">
        <AlertDescription>
          The charts couldn't be loaded. Please reload the page.
        </AlertDescription>
      </Alert>
    )
  } else if (!series.data || !summary.data) {
    body = <p className="text-sm text-muted-foreground">Loading charts…</p>
  } else if (!hasAttributes) {
    // The metrics row above already links to choosing them.
    body = (
      <p className="text-sm text-muted-foreground">
        Charts appear once the logbook has metrics.
      </p>
    )
  } else if (mode === 'metric' && subjects.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        Choose at least one participant above to see their charts.
      </p>
    )
  } else if (mode === 'participant' && attributes.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        Choose at least one metric above to see it in the charts.
      </p>
    )
  } else {
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        {mode === 'metric'
          ? attributes.map((attribute) => (
              <MetricChart
                key={attribute.id}
                attribute={attribute}
                subjects={subjects}
                points={series.data}
                summary={summary.data}
              />
            ))
          : subjects.map((subject) => (
              <ParticipantChart
                key={subject.id}
                subject={subject}
                attributes={attributes}
                points={series.data}
                summary={summary.data}
              />
            ))}
      </div>
    )
  }

  return (
    <section aria-labelledby="charts-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="charts-heading" className="font-heading text-lg font-semibold">
          Charts
        </h2>
        {canSwitch && (
          <div
            role="group"
            aria-label="Chart view"
            className="inline-flex rounded-lg border p-0.5"
          >
            {modes.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={mode === option.value}
                onClick={() => onModeChange(option.value)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  mode === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {canSwitch && (
        <p className="-mt-2 text-sm text-muted-foreground">
          {mode === 'metric'
            ? 'Each metric with every participant, in its own unit. Tap participants above to compare fewer.'
            : 'Each participant with every metric, as change since its first entry. Tap metrics above to show fewer.'}
        </p>
      )}
      {body}
    </section>
  )
}
