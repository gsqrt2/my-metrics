import { useAuth } from '@/features/auth/use-auth'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import { useSubjects } from '@/features/subjects/use-subjects'

// Compact row of the group's active subjects on the group page. Owners and
// editors manage them on the subjects page ("Manage participants" in the header; "participant" is the UI's word for a subject).
export function SubjectsSection({ group }: { group: GroupRow }) {
  const subjects = useSubjects(group.id)
  const { session } = useAuth()
  const active = subjects.data?.filter((s) => !s.archived_at) ?? []

  return (
    <section
      aria-labelledby="subjects-heading"
      className="flex flex-wrap items-center gap-x-4 gap-y-3"
    >
      <h2
        id="subjects-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Participants
      </h2>
      {subjects.isError && (
        <p className="text-sm text-destructive">
          The participants couldn't be loaded.
        </p>
      )}
      {subjects.data && active.length === 0 && (
        <p className="text-sm text-muted-foreground">None yet.</p>
      )}
      {active.length > 0 && (
        <ul aria-label="Participants" className="flex flex-wrap gap-2">
          {active.map((subject) => (
            <li
              key={subject.id}
              className="inline-flex max-w-full items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm"
            >
              <SubjectAvatar
                name={subject.name}
                color={subject.color}
                className="size-6 text-[0.625rem]"
              />
              <span className="truncate">{subject.name}</span>
              {subject.linked_user_id === session?.user.id && (
                <span className="text-muted-foreground">(you)</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
