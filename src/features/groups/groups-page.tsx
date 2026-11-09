import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { GroupMeta } from '@/features/groups/group-meta'
import { useGroups } from '@/features/groups/use-groups'

// FR-12: the first page after login.
export function GroupsPage() {
  const groups = useGroups()

  return (
    <>
      <PageHeader
        title="Logbooks"
        description="Every logbook you keep or share with others."
        actions={
          <Button asChild>
            <Link to="/logbooks/new">
              <Plus aria-hidden />
              New logbook
            </Link>
          </Button>
        }
      />
      {groups.isPending && (
        <p className="text-sm text-muted-foreground">Loading your logbooks…</p>
      )}
      {groups.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Your logbooks couldn't be loaded. Please reload the page.
          </AlertDescription>
        </Alert>
      )}
      {groups.data && (
        <ul aria-label="Your logbooks" className="grid gap-4 md:grid-cols-2">
          {groups.data.map((group) => (
            <li key={group.id}>
              <Link
                to={`/logbooks/${group.id}`}
                className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 text-card-foreground transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <h2 className="font-heading text-lg font-semibold break-words">
                  {group.name}
                </h2>
                {group.description && (
                  <p className="line-clamp-2 text-sm break-words text-muted-foreground">
                    {group.description}
                  </p>
                )}
                <div className="mt-auto">
                  <GroupMeta group={group} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
