import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import { GroupForm } from '@/features/groups/group-form'
import { WithGroup } from '@/features/groups/group-page'
import { toGroupForm } from '@/features/groups/schemas'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { groupErrorMessage, useUpdateGroup } from '@/features/groups/use-groups'

// FR-11: owners and editors edit name, description and duration.
export function EditGroupPage() {
  return <WithGroup>{(group) => <EditGroup group={group} />}</WithGroup>
}

function EditGroup({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const update = useUpdateGroup(group.id)
  const groupPath = `/groups/${group.id}`

  if (!canEditGroup(group)) {
    return (
      <>
        <PageHeader
          title="Edit group"
          description="Only the group's owner and editors can change it."
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Edit group" description={group.name} />
      <GroupForm
        defaultValues={toGroupForm(group)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        cancelTo={groupPath}
        isPending={update.isPending}
        error={update.error ? groupErrorMessage(update.error) : undefined}
        onSubmit={(fields) =>
          update.mutate(fields, { onSuccess: () => navigate(groupPath) })
        }
      />
    </>
  )
}
