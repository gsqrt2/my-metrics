import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { formatAge } from '@/features/subjects/age'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import { useSubjects, type Subject } from '@/features/subjects/use-subjects'

// FR-30 – FR-32: the group's subjects with their details, for owners and
// editors to add, edit, archive and restore. Archived ones are hidden until
// asked for.
export function SubjectsPage() {
  return <WithGroup>{(group) => <ManageSubjects group={group} />}</WithGroup>
}

function ManageSubjects({ group }: { group: GroupRow }) {
  const subjects = useSubjects(group.id)
  const [showArchived, setShowArchived] = useState(false)
  const groupPath = `/groups/${group.id}`
  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Subjects"
          description="Only the group's owner and editors can manage subjects."
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  const active = subjects.data?.filter((s) => !s.archived_at) ?? []
  const archived = subjects.data?.filter((s) => s.archived_at) ?? []

  return (
    <>
      {back}
      <PageHeader
        title="Subjects"
        description={`Who or what you measure in ${group.name}.`}
        actions={
          <Button asChild>
            <Link to={`${groupPath}/subjects/new`}>
              <Plus aria-hidden />
              Add subject
            </Link>
          </Button>
        }
      />
      <div className="flex max-w-2xl flex-col gap-4">
        {subjects.isPending && (
          <p className="text-sm text-muted-foreground">Loading subjects…</p>
        )}
        {subjects.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              The subjects couldn't be loaded. Please reload the page.
            </AlertDescription>
          </Alert>
        )}
        {subjects.data && active.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No subjects yet. Add who or what you measure here, like a child or
            yourself.
          </p>
        )}
        {active.length > 0 && (
          <SubjectList label="Subjects" subjects={active} groupId={group.id} />
        )}

        {archived.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              aria-expanded={showArchived}
              onClick={() => setShowArchived((show) => !show)}
            >
              {showArchived
                ? 'Hide archived subjects'
                : `Show archived subjects (${archived.length})`}
            </Button>
            {showArchived && (
              <SubjectList
                label="Archived subjects"
                subjects={archived}
                groupId={group.id}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

function SubjectList({
  label,
  subjects,
  groupId,
}: {
  label: string
  subjects: Subject[]
  groupId: string
}) {
  const { session } = useAuth()
  const userId = session?.user.id

  return (
    <ul aria-label={label} className="divide-y rounded-xl border bg-card">
      {subjects.map((subject) => (
        <li key={subject.id} className="flex items-center gap-3 px-4 py-3">
          <SubjectAvatar
            name={subject.name}
            color={subject.color}
            className={subject.archived_at ? 'opacity-50' : undefined}
          />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium break-words">{subject.name}</span>
              {subject.linked_user_id === userId && (
                <Badge variant="secondary">You</Badge>
              )}
              {subject.linked_user_id && subject.linked_user_id !== userId && (
                <Badge variant="outline">Member</Badge>
              )}
              {subject.archived_at && <Badge variant="outline">Archived</Badge>}
            </div>
            {subject.birthdate && (
              <span className="text-sm text-muted-foreground">
                {formatAge(subject.birthdate)}
              </span>
            )}
          </div>
          <Button asChild variant="ghost" size="icon">
            <Link
              to={`/groups/${groupId}/subjects/${subject.id}/edit`}
              aria-label={`Edit ${subject.name}`}
            >
              <Pencil aria-hidden />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}
