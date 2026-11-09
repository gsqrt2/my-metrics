import { Archive, ArchiveRestore } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/use-auth'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'
import { toSubjectForm } from '@/features/subjects/schemas'
import { SubjectForm } from '@/features/subjects/subject-form'
import {
  useSubjects,
  useUpdateSubject,
  type Subject,
} from '@/features/subjects/use-subjects'

// FR-30 – FR-33: edit, archive and restore a subject.
export function EditSubjectPage() {
  return <WithGroup>{(group) => <FindSubject group={group} />}</WithGroup>
}

function FindSubject({ group }: { group: GroupRow }) {
  const { subjectId } = useParams()
  const subjects = useSubjects(group.id)
  const groupPath = `/logbooks/${group.id}`
  const subjectsPath = `${groupPath}/participants`
  const back = <BackLink to={subjectsPath}>Participants</BackLink>

  if (subjects.isPending) return null
  const subject = subjects.data?.find((s) => s.id === subjectId)

  if (!subject || !canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title={subject ? 'Edit participant' : 'Participant not found'}
          description={
            subject
              ? "Only the logbook's owner and editors can change participants."
              : "It doesn't exist in this logbook."
          }
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }
  return <EditSubject group={group} subject={subject} back={back} />
}

function EditSubject({
  group,
  subject,
  back,
}: {
  group: GroupRow
  subject: Subject
  back: React.ReactNode
}) {
  const navigate = useNavigate()
  const { session } = useAuth()
  const update = useUpdateSubject(subject)
  const archive = useUpdateSubject(subject)
  const groupPath = `/logbooks/${group.id}`
  const subjectsPath = `${groupPath}/participants`
  const isArchived = subject.archived_at !== null

  let nameHint: string | undefined
  if (subject.linked_user_id) {
    const whose =
      subject.linked_user_id === session?.user.id
        ? 'your display name'
        : "the member's display name"
    nameHint = subject.name_customized
      ? `Renamed in this logbook, so it no longer follows ${whose}. Use the same name again to follow it.`
      : `Follows ${whose} until you rename it here.`
  }

  return (
    <>
      {back}
      <PageHeader title="Edit participant" description={subject.name} />
      <div className="flex max-w-xl flex-col gap-8">
        <SubjectForm
          defaultValues={toSubjectForm(subject)}
          nameHint={nameHint}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelTo={subjectsPath}
          isPending={update.isPending}
          error={
            update.isError ? 'Saving failed. Please try again.' : undefined
          }
          onSubmit={(fields) =>
            update.mutate(fields, { onSuccess: () => navigate(subjectsPath) })
          }
        />

        <Separator />

        <section
          aria-labelledby="archive-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="archive-heading" className="font-heading font-semibold">
            {isArchived ? 'Archived' : 'Archive'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isArchived
              ? 'This participant is hidden from the logbook and no new entries can be logged for it. Restore it to log again.'
              : 'Hides this participant from the logbook and stops new entries for it. Its entries are kept, and you can restore it at any time.'}
          </p>
          {archive.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                That didn't work. Please try again.
              </AlertDescription>
            </Alert>
          )}
          <Button
            variant="outline"
            className="self-start"
            disabled={archive.isPending}
            onClick={() =>
              archive.mutate(
                { archived_at: isArchived ? null : new Date().toISOString() },
                { onSuccess: () => navigate(subjectsPath) },
              )
            }
          >
            {isArchived ? (
              <>
                <ArchiveRestore aria-hidden />
                Restore participant
              </>
            ) : (
              <>
                <Archive aria-hidden />
                Archive participant
              </>
            )}
          </Button>
        </section>
      </div>
    </>
  )
}
