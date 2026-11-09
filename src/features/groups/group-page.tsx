import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { GroupMeta } from '@/features/groups/group-meta'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { useGroup } from '@/features/groups/use-groups'
import { AttributesSection } from '@/features/attributes/attributes-section'
import { EntriesSection } from '@/features/entries/entries-section'
import { GroupOptionsMenu } from '@/features/groups/group-options-menu'
import { useAttributes } from '@/features/attributes/use-attributes'
import { useChartMode } from '@/features/dashboard/chart-mode'
import { isSelected, type Selection } from '@/features/dashboard/selection'
import { SubjectsSection } from '@/features/subjects/subjects-section'
import { useSubjects } from '@/features/subjects/use-subjects'

// The charts bring in Recharts, a large library, so they load only when a
// group page needs them, not with the rest of the app.
const ChartsSection = lazy(() =>
  import('@/features/dashboard/charts-section').then((module) => ({
    default: module.ChartsSection,
  })),
)

// Loads the group in the URL and shows loading, error and not-found states, so
// group pages only render once there is a group.
export function WithGroup({
  children,
}: {
  children: (group: GroupRow) => React.ReactNode
}) {
  const { groupId } = useParams()
  const group = useGroup(groupId!)

  if (group.isPending) {
    return <p className="text-sm text-muted-foreground">Loading the logbook…</p>
  }
  if (group.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          The logbook couldn't be loaded. Please reload the page.
        </AlertDescription>
      </Alert>
    )
  }
  if (!group.data) {
    return (
      <>
        <PageHeader
          title="Logbook not found"
          description="It doesn't exist, or you're not a member of it."
        />
        <Button asChild variant="outline">
          <Link to="/logbooks">Back to your logbooks</Link>
        </Button>
      </>
    )
  }
  return children(group.data)
}

// The group's home: its subjects (which filter the charts) and attributes,
// then a chart per attribute (FR-60), then the latest entries, which are
// secondary.
export function GroupPage() {
  return <WithGroup>{(group) => <GroupHome group={group} />}</WithGroup>
}

function GroupHome({ group }: { group: GroupRow }) {
  const subjects = useSubjects(group.id)
  const attributes = useAttributes(group.id)
  const activeSubjects = subjects.data?.filter((s) => !s.archived_at)
  const activeAttributes = attributes.data?.filter((a) => !a.archived_at)

  // Two chart views (decided 2026-11-09). With one participant they're the
  // same, so there's no switch and the view is "by metric".
  const [chosenMode, setMode] = useChartMode(group.id)
  const canSwitch = (activeSubjects?.length ?? 0) > 1
  const mode = canSwitch ? chosenMode : 'metric'

  // Each view filters one row of chips; null means all.
  const [subjectFilter, setSubjectFilter] = useState<Selection>(null)
  const [attributeFilter, setAttributeFilter] = useState<Selection>(null)
  const chartSubjects =
    activeSubjects?.filter(
      (s) => mode === 'participant' || isSelected(subjectFilter, s.id),
    ) ?? []
  const chartAttributes =
    activeAttributes?.filter(
      (a) => mode === 'metric' || isSelected(attributeFilter, a.id),
    ) ?? []

  return (
    <>
      <BackLink to="/logbooks">Logbooks</BackLink>
      <PageHeader
        title={group.name}
        description={group.description ?? undefined}
        actions={canEditGroup(group) && <GroupOptionsMenu group={group} />}
      />
      <div className="-mt-4 mb-8">
        <GroupMeta group={group} />
      </div>
      <div className="flex flex-col gap-4">
        <SubjectsSection
          subjects={activeSubjects}
          isError={subjects.isError}
          filters={mode === 'metric' && canSwitch}
          selected={subjectFilter}
          onSelectedChange={setSubjectFilter}
        />
        <AttributesSection
          group={group}
          attributes={activeAttributes}
          isError={attributes.isError}
          filters={mode === 'participant'}
          selected={attributeFilter}
          onSelectedChange={setAttributeFilter}
        />
        <div className="mt-6">
          <Suspense
            fallback={
              <p className="text-sm text-muted-foreground">Loading charts…</p>
            }
          >
            <ChartsSection
              group={group}
              mode={mode}
              onModeChange={setMode}
              canSwitch={canSwitch}
              subjects={chartSubjects}
              attributes={chartAttributes}
              hasAttributes={(activeAttributes?.length ?? 0) > 0}
            />
          </Suspense>
        </div>
        <div className="mt-6">
          <EntriesSection group={group} />
        </div>
      </div>
    </>
  )
}
