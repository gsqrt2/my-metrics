import { Link, useNavigate } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { GroupForm } from '@/features/groups/group-form'
import { ArchiveDeleteSection } from '@/features/groups/group-lifecycle'
import { WithGroup } from '@/features/groups/group-page'
import { toGroupForm } from '@/features/groups/schemas'
import {
  canEditGroup,
  cantManageText,
  type GroupRow,
} from '@/features/groups/types'
import { groupErrorMessage, useUpdateGroup } from '@/features/groups/use-groups'

// FR-11: owners and editors edit name, description and duration; the owner
// also "Everyone logs only for themselves" (§5).
export function EditGroupPage() {
  return <WithGroup>{(group) => <EditGroup group={group} />}</WithGroup>
}

function EditGroup({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const update = useUpdateGroup(group.id)
  const groupPath = `/logbooks/${group.id}`

  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Edit logbook"
          description={cantManageText(
            group,
            "Only the logbook's owner and editors can change it.",
          )}
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      {back}
      <PageHeader title="Edit logbook" description={group.name} />
      <GroupForm
        defaultValues={toGroupForm(group, group.membersEditOwnSubjectOnly)}
        submitLabel="Save changes"
        pendingLabel="Saving…"
        cancelTo={groupPath}
        isPending={update.isPending}
        error={update.error ? groupErrorMessage(update.error) : undefined}
        offerOwnSubjectOnly={group.role === 'owner'}
        onSubmit={(fields, ownSubjectOnly) =>
          update.mutate(
            {
              ...fields,
              ownSubjectOnly:
                group.role === 'owner' &&
                ownSubjectOnly !== group.membersEditOwnSubjectOnly
                  ? ownSubjectOnly
                  : undefined,
            },
            { onSuccess: () => navigate(groupPath) },
          )
        }
      />
      {group.role === 'owner' && (
        <>
          <Separator className="my-8 max-w-xl" />
          <ArchiveDeleteSection group={group} />
        </>
      )}
    </>
  )
}
