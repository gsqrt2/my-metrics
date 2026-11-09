import { useState } from 'react'

import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { Attribute } from '@/features/attributes/use-attributes'
import { SMALL_CHART_MAX_POINTS } from '@/features/dashboard/chart-data'
import type { ChartMode } from '@/features/dashboard/chart-mode'
import {
  ChartOverlay,
  type OpenChart,
} from '@/features/dashboard/chart-overlay'
import { MetricChart } from '@/features/dashboard/metric-chart'
import { ParticipantChart } from '@/features/dashboard/participant-chart'
import { isSelected, type Selection } from '@/features/dashboard/selection'
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
// The chip rows above choose the subjects or the attributes. Each chart opens
// full screen (FR-61). The small charts get at most 100 points per line;
// beyond that the database averages entries per day, week or month.
export function ChartsSection({
  group,
  mode,
  onModeChange,
  canSwitch,
  subjects,
  attributes,
  subjectFilter,
  onSubjectFilterChange,
  attributeFilter,
  onAttributeFilterChange,
}: {
  group: GroupRow
  mode: ChartMode
  onModeChange: (mode: ChartMode) => void
  // Only with more than one participant; with one, both views are the same.
  canSwitch: boolean
  // All active ones; the filters choose among them.
  subjects: Subject[]
  attributes: Attribute[]
  subjectFilter: Selection
  onSubjectFilterChange: (selected: Selection) => void
  attributeFilter: Selection
  onAttributeFilterChange: (selected: Selection) => void
}) {
  const series = useSeries(group.id, { maxPoints: SMALL_CHART_MAX_POINTS })
  const summary = useDashboard(group.id)
  const [open, setOpen] = useState<OpenChart | null>(null)

  const chartSubjects = subjects.filter(
    (s) => mode === 'participant' || isSelected(subjectFilter, s.id),
  )
  const chartAttributes = attributes.filter(
    (a) => mode === 'metric' || isSelected(attributeFilter, a.id),
  )

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
  } else if (attributes.length === 0) {
    // The metrics row above already links to choosing them.
    body = (
      <p className="text-sm text-muted-foreground">
        Charts appear once the logbook has metrics.
      </p>
    )
  } else if (mode === 'metric' && chartSubjects.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        Choose at least one participant above to see their charts.
      </p>
    )
  } else if (mode === 'participant' && chartAttributes.length === 0) {
    body = (
      <p className="text-sm text-muted-foreground">
        Choose at least one metric above to see it in the charts.
      </p>
    )
  } else {
    body = (
      <div className="grid gap-4 lg:grid-cols-2">
        {mode === 'metric'
          ? chartAttributes.map((attribute) => (
              <MetricChart
                key={attribute.id}
                attribute={attribute}
                subjects={chartSubjects}
                points={series.data}
                summary={summary.data}
                onOpen={() =>
                  setOpen({ mode: 'metric', attributeId: attribute.id })
                }
              />
            ))
          : chartSubjects.map((subject) => (
              <ParticipantChart
                key={subject.id}
                subject={subject}
                attributes={chartAttributes}
                points={series.data}
                summary={summary.data}
                onOpen={() =>
                  setOpen({ mode: 'participant', subjectId: subject.id })
                }
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
          <Segmented
            label="Chart view"
            options={modes}
            value={mode}
            onChange={onModeChange}
          />
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
      <ChartOverlay
        group={group}
        open={open}
        onClose={() => setOpen(null)}
        subjects={subjects}
        attributes={attributes}
        subjectFilter={subjectFilter}
        onSubjectFilterChange={onSubjectFilterChange}
        attributeFilter={attributeFilter}
        onAttributeFilterChange={onAttributeFilterChange}
      />
    </section>
  )
}
