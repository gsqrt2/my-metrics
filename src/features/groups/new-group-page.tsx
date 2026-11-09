import { useNavigate } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { GroupForm } from '@/features/groups/group-form'
import { emptyGroupForm } from '@/features/groups/schemas'
import { groupErrorMessage, useCreateGroup } from '@/features/groups/use-groups'

// FR-10, FR-14: a new group is private; its creator becomes the owner.
export function NewGroupPage() {
  const navigate = useNavigate()
  const create = useCreateGroup()

  return (
    <>
      <BackLink to="/logbooks">Logbooks</BackLink>
      <PageHeader
        title="New logbook"
        description="Only you can see it until you invite others."
      />
      <GroupForm
        defaultValues={emptyGroupForm}
        submitLabel="Create logbook"
        pendingLabel="Creating…"
        cancelTo="/logbooks"
        isPending={create.isPending}
        error={create.error ? groupErrorMessage(create.error) : undefined}
        onSubmit={(fields) =>
          create.mutate(fields, {
            onSuccess: (id) => navigate(`/logbooks/${id}`),
          })
        }
      />
    </>
  )
}
