import { Link, useNavigate } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import { AttributeForm } from '@/features/attributes/attribute-form'
import { emptyAttributeForm } from '@/features/attributes/schemas'
import {
  attributeErrorMessage,
  useCreateAttribute,
} from '@/features/attributes/use-attributes'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'

// FR-40: owners and editors add attributes, shown as "metrics".
export function NewAttributePage() {
  return <WithGroup>{(group) => <NewAttribute group={group} />}</WithGroup>
}

function NewAttribute({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const create = useCreateAttribute(group.id)
  const metricsPath = `/logbooks/${group.id}/metrics`
  const back = <BackLink to={metricsPath}>Metrics</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Add metric"
          description="Only the logbook's owner and editors can add metrics."
        />
        <Button asChild variant="outline">
          <Link to={`/logbooks/${group.id}`}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  return (
    <>
      {back}
      <PageHeader
        title="Add metric"
        description={`Something you measure in ${group.name}, like weight or height.`}
      />
      <AttributeForm
        defaultValues={emptyAttributeForm}
        submitLabel="Add metric"
        pendingLabel="Adding…"
        cancelTo={metricsPath}
        isPending={create.isPending}
        error={create.error ? attributeErrorMessage(create.error) : undefined}
        onSubmit={(fields) =>
          create.mutate(fields, { onSuccess: () => navigate(metricsPath) })
        }
      />
    </>
  )
}
