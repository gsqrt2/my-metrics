import { Pencil } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/app/layout/page-header'
import { Placeholder } from '@/app/placeholder'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { GroupMeta } from '@/features/groups/group-meta'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { useGroup } from '@/features/groups/use-groups'

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
    return <p className="text-sm text-muted-foreground">Loading the group…</p>
  }
  if (group.isError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          The group couldn't be loaded. Please reload the page.
        </AlertDescription>
      </Alert>
    )
  }
  if (!group.data) {
    return (
      <>
        <PageHeader
          title="Group not found"
          description="It doesn't exist, or you're not a member of it."
        />
        <Button asChild variant="outline">
          <Link to="/groups">Back to your groups</Link>
        </Button>
      </>
    )
  }
  return children(group.data)
}

// The group's home. Steps 4–8 fill it with subjects, attributes, entries and
// the dashboard.
export function GroupPage() {
  return (
    <WithGroup>
      {(group) => (
        <>
          <PageHeader
            title={group.name}
            description={group.description ?? undefined}
            actions={
              canEditGroup(group) && (
                <Button asChild variant="outline">
                  <Link to={`/groups/${group.id}/edit`}>
                    <Pencil aria-hidden />
                    Edit group
                  </Link>
                </Button>
              )
            }
          />
          <div className="-mt-4 mb-8">
            <GroupMeta group={group} />
          </div>
          <Placeholder>
            Subjects, attributes and entries will appear here (plan steps 4–6).
          </Placeholder>
        </>
      )}
    </WithGroup>
  )
}
