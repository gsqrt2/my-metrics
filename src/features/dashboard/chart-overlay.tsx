import { useState } from 'react'

import { Segmented } from '@/components/segmented'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { AttributesSection } from '@/features/attributes/attributes-section'
import { attributeLabel } from '@/features/attributes/format'
import type { Attribute } from '@/features/attributes/use-attributes'
import {
  fullScreenMaxPoints,
  periodRange,
  type Period,
  type XMode,
  type YMode,
} from '@/features/dashboard/chart-data'
import { MetricLines, ParticipantLines } from '@/features/dashboard/chart-lines'
import { metricColors } from '@/features/dashboard/metric-colors'
import type { Selection } from '@/features/dashboard/selection'
import { useSeries, type Baseline } from '@/features/dashboard/use-dashboard'
import type { GroupRow } from '@/features/groups/types'
import { subjectColorVar } from '@/features/subjects/colors'
import { SubjectsSection } from '@/features/subjects/subjects-section'
import type { Subject } from '@/features/subjects/use-subjects'

// What's open full screen: one attribute ("by metric") or one subject ("by
// participant").
export type OpenChart =
  | { mode: 'metric'; attributeId: string }
  | { mode: 'participant'; subjectId: string }

const yModes: { value: YMode; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'change', label: 'Change' },
  { value: 'pct', label: '% change' },
]
const xModes: { value: XMode; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'age', label: 'Age' },
]
const baselines: { value: Baseline; label: string }[] = [
  { value: 'first', label: 'Since first entry' },
  { value: 'group_start', label: 'Since start' },
]

// A chart of the group page, full screen (FR-61 – FR-64): the same lines and
// chip filter as on the page, plus a time span, the x-axis by date or age,
// the y-axis as value, change or % change ("by metric"), and the baseline for
// groups with a duration. More points than the small charts: as many as the
// width allows, grouped by the database only beyond that.
export function ChartOverlay({
  group,
  open,
  onClose,
  subjects,
  attributes,
  subjectFilter,
  onSubjectFilterChange,
  attributeFilter,
  onAttributeFilterChange,
}: {
  group: GroupRow
  open: OpenChart | null
  onClose: () => void
  // All active ones; the filters choose among them.
  subjects: Subject[]
  attributes: Attribute[]
  subjectFilter: Selection
  onSubjectFilterChange: (selected: Selection) => void
  attributeFilter: Selection
  onAttributeFilterChange: (selected: Selection) => void
}) {
  return (
    <Sheet open={open !== null} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="flex h-svh flex-col gap-3 overflow-y-auto p-4 data-[side=bottom]:h-svh [@media(max-height:500px)]:gap-2 [@media(max-height:500px)]:py-2"
      >
        {open && (
          <FullScreenChart
            // A fresh set of choices for each chart opened.
            key={open.mode === 'metric' ? open.attributeId : open.subjectId}
            group={group}
            open={open}
            subjects={subjects}
            attributes={attributes}
            subjectFilter={subjectFilter}
            onSubjectFilterChange={onSubjectFilterChange}
            attributeFilter={attributeFilter}
            onAttributeFilterChange={onAttributeFilterChange}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function FullScreenChart({
  group,
  open,
  subjects,
  attributes,
  subjectFilter,
  onSubjectFilterChange,
  attributeFilter,
  onAttributeFilterChange,
}: Omit<Parameters<typeof ChartOverlay>[0], 'open' | 'onClose'> & {
  open: OpenChart
}) {
  const hasDuration = group.starts_on !== null && group.ends_on !== null
  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All' },
  ]
  const [period, setPeriod] = useState<Period>('all')
  const [y, setY] = useState<YMode>('value')
  const [x, setX] = useState<XMode>('date')
  const [baseline, setBaseline] = useState<Baseline>('first')
  const [maxPoints] = useState(() => fullScreenMaxPoints(window.innerWidth))

  const range = periodRange(period)
  const series = useSeries(group.id, { ...range, maxPoints, baseline })

  const isMetric = open.mode === 'metric'
  const attribute = isMetric
    ? attributes.find((a) => a.id === open.attributeId)
    : undefined
  const subject = !isMetric
    ? subjects.find((s) => s.id === open.subjectId)
    : undefined
  const shownSubjects = isMetric
    ? subjects.filter((s) => subjectFilter === null || subjectFilter.has(s.id))
    : subject
      ? [subject]
      : []
  const shownAttributes = isMetric
    ? attribute
      ? [attribute]
      : []
    : attributes.filter(
        (a) => attributeFilter === null || attributeFilter.has(a.id),
      )
  // FR-63: by age only when every shown subject has a birthdate.
  const canAge =
    shownSubjects.length > 0 && shownSubjects.every((s) => s.birthdate)
  const xMode = canAge ? x : 'date'
  const yMode = isMetric ? y : 'pct'
  const showsChange = yMode !== 'value'

  const title = attribute
    ? attributeLabel(attribute)
    : (subject?.name ?? 'Chart')
  const colors = metricColors(shownAttributes.map((a) => a.id))

  return (
    <>
      <SheetHeader className="p-0 pr-10">
        <SheetTitle className="text-lg">{title}</SheetTitle>
        <SheetDescription className="[@media(max-height:500px)]:sr-only">
          {isMetric
            ? 'Every chosen participant, in this metric.'
            : 'Every chosen metric, as change since its baseline.'}
        </SheetDescription>
      </SheetHeader>

      {isMetric ? (
        <SubjectsSection
          subjects={subjects}
          isError={false}
          filters={subjects.length > 1}
          selected={subjectFilter}
          onSelectedChange={onSubjectFilterChange}
        />
      ) : (
        <AttributesSection
          group={group}
          attributes={attributes}
          isError={false}
          filters
          selected={attributeFilter}
          onSelectedChange={onAttributeFilterChange}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          label="Time span"
          options={periods}
          value={period}
          onChange={setPeriod}
        />
        {isMetric && (
          <Segmented label="Show" options={yModes} value={y} onChange={setY} />
        )}
        {hasDuration && showsChange && (
          <Segmented
            label="Baseline"
            options={baselines}
            value={baseline}
            onChange={setBaseline}
          />
        )}
        {canAge && (
          <Segmented
            label="X-axis"
            options={xModes}
            value={xMode}
            onChange={setX}
          />
        )}
      </div>

      <div className="min-h-56 flex-1">
        {series.isError ? (
          <Alert variant="destructive">
            <AlertDescription>
              The chart couldn't be loaded. Please try again.
            </AlertDescription>
          </Alert>
        ) : !series.data ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : isMetric && attribute ? (
          shownSubjects.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose at least one participant above.
            </p>
          ) : (
            <MetricLines
              attribute={attribute}
              subjects={shownSubjects}
              points={series.data}
              x={xMode}
              y={yMode}
              className="h-full min-h-56"
            />
          )
        ) : subject ? (
          shownAttributes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Choose at least one metric above.
            </p>
          ) : (
            <ParticipantLines
              subject={subject}
              attributes={shownAttributes}
              points={series.data}
              x={xMode}
              className="h-full min-h-56"
            />
          )
        ) : null}
        {series.data &&
          (isMetric ? shownSubjects : shownAttributes).length > 0 &&
          !series.data.some(
            (p) =>
              (isMetric
                ? p.attribute_id === attribute?.id &&
                  shownSubjects.some((s) => s.id === p.subject_id)
                : p.subject_id === subject?.id) && p.entry_count > 0,
          ) && (
            <p className="text-sm text-muted-foreground">
              Nothing logged in this time span.
            </p>
          )}
      </div>

      {/* Legend: which colour is which line. */}
      <ul
        aria-label="Legend"
        className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
      >
        {isMetric
          ? shownSubjects.map((s) => (
              <li key={s.id} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: subjectColorVar(s.color) }}
                />
                {s.name}
              </li>
            ))
          : shownAttributes
              .filter((a) => colors.has(a.id))
              .map((a) => (
                <li key={a.id} className="inline-flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2.5 rounded-full"
                    style={{
                      backgroundColor: subjectColorVar(colors.get(a.id)!),
                    }}
                  />
                  {attributeLabel(a)}
                </li>
              ))}
      </ul>
    </>
  )
}
