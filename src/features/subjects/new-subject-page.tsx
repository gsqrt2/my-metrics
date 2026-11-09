import { Link, useNavigate } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { nextSubjectColor } from '@/features/subjects/colors'
import { SubjectForm } from '@/features/subjects/subject-form'
import { useCreateSubject, useSubjects } from '@/features/subjects/use-subjects'

// FR-30: owners and editors add subjects.
export function NewSubjectPage() {
  return <WithGroup>{(group) => <NewSubject group={group} />}</WithGroup>
}

function NewSubject({ group }: { group: GroupRow }) {
  const navigate = useNavigate()
  const subjects = useSubjects(group.id)
  const create = useCreateSubject(group.id)
  const groupPath = `/groups/${group.id}`
  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Add subject"
          description="Only the group's owner and editors can add subjects."
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }
  // Wait for the existing subjects, to start with an unused colour.
  if (!subjects.data) return null

  return (
    <>
      {back}
      <PageHeader
        title="Add subject"
        description={`Who or what you measure in ${group.name}.`}
      />
      <SubjectForm
        defaultValues={{
          name: '',
          birthdate: '',
          color: nextSubjectColor(subjects.data.map((s) => s.color)),
        }}
        submitLabel="Add subject"
        pendingLabel="Adding…"
        cancelTo={groupPath}
        isPending={create.isPending}
        error={create.isError ? 'Saving failed. Please try again.' : undefined}
        onSubmit={(fields) =>
          create.mutate(fields, { onSuccess: () => navigate(groupPath) })
        }
      />
    </>
  )
}
