import { Link, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Placeholder } from '@/app/placeholder'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { GroupMeta } from '@/features/groups/group-meta'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { useGroup } from '@/features/groups/use-groups'
import { AttributesSection } from '@/features/attributes/attributes-section'
import { EntriesSection } from '@/features/entries/entries-section'
import { GroupOptionsMenu } from '@/features/groups/group-options-menu'
import { SubjectsSection } from '@/features/subjects/subjects-section'

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

// The group's home: its subjects and attributes, then charts (steps 7–8,
// a placeholder for now), then the latest entries, which are secondary.
export function GroupPage() {
  return (
    <WithGroup>
      {(group) => (
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
            <SubjectsSection group={group} />
            <AttributesSection group={group} />
            <section
              aria-labelledby="charts-heading"
              className="mt-6 flex flex-col gap-4"
            >
              <h2
                id="charts-heading"
                className="font-heading text-lg font-semibold"
              >
                Charts
              </h2>
              <Placeholder>
                A chart for each metric, with every participant's progress, will
                appear here (plan steps 7–8).
              </Placeholder>
            </section>
            <div className="mt-6">
              <EntriesSection group={group} />
            </div>
          </div>
        </>
      )}
    </WithGroup>
  )
}
