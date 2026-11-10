import { Alert, AlertDescription } from '@/components/ui/alert'
import { Segmented } from '@/components/segmented'
import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { attributeLabel } from '@/features/attributes/format'
import { useAttributes } from '@/features/attributes/use-attributes'
import { useAuth } from '@/features/auth/use-auth'
import { canLogFor } from '@/features/entries/permissions'
import { WithGroup } from '@/features/groups/group-page'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import { useSubjects } from '@/features/subjects/use-subjects'
import {
  useSetVisibility,
  useVisibilitySettings,
  type Visibility,
} from '@/features/visibility/use-visibility'

const options: { value: Visibility; label: string }[] = [
  { value: 'absolute', label: 'Actual values' },
  { value: 'relative', label: '% only' },
]

// FR-43: what the other members see of a participant's values, per metric.
// Decided by the linked user for their own participant, and for a
// participant without an account by whoever may log for it. Nobody else,
// the owner included.
export function PrivacyPage() {
  return <WithGroup>{(group) => <Privacy group={group} />}</WithGroup>
}

function Privacy({ group }: { group: GroupRow }) {
  const { session } = useAuth()
  const userId = session?.user.id
  const subjects = useSubjects(group.id)
  const attributes = useAttributes(group.id)
  const settings = useVisibilitySettings(group.id)
  const set = useSetVisibility(group.id)

  // Mirrors can_set_visibility in the database.
  const mine =
    subjects.data?.filter(
      (s) =>
        !s.archived_at &&
        !s.visibility_frozen &&
        (s.linked_user_id === userId ||
          (s.linked_user_id === null && canLogFor(group, s, userId))),
    ) ?? []
  const active = attributes.data?.filter((a) => !a.archived_at) ?? []
  const current = (subjectId: string, attributeId: string): Visibility =>
    settings.data?.find(
      (v) => v.subject_id === subjectId && v.attribute_id === attributeId,
    )?.visibility ?? 'absolute'

  return (
    <>
      <BackLink to={`/logbooks/${group.id}`}>{group.name}</BackLink>
      <PageHeader
        title="Privacy"
        description="Choose, per metric, what the other members see. With “% only” they see how much a value changed since the first entry, not the value itself. Dates and comments stay visible."
      />
      <div className="flex max-w-2xl flex-col gap-6">
        {(subjects.isError || attributes.isError || settings.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              The settings couldn't be loaded. Please reload the page.
            </AlertDescription>
          </Alert>
        )}
        {set.isError && (
          <Alert variant="destructive">
            <AlertDescription>
              The change couldn't be saved. Please try again.
            </AlertDescription>
          </Alert>
        )}
        {subjects.data && attributes.data && mine.length === 0 && (
          <p className="text-sm text-muted-foreground">
            There's no participant here whose privacy you decide. You decide it
            for your own participant, and for participants without an account
            that you may log for.
          </p>
        )}
        {subjects.data &&
          attributes.data &&
          mine.length > 0 &&
          active.length === 0 && (
            <p className="text-sm text-muted-foreground">
              This logbook has no metrics yet.
            </p>
          )}
        {mine.length > 0 &&
          active.length > 0 &&
          mine.map((subject) => (
            <section
              key={subject.id}
              aria-label={subject.name}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4"
            >
              <h2 className="flex items-center gap-2 font-heading font-semibold">
                <SubjectAvatar
                  name={subject.name}
                  color={subject.color}
                  className="size-6 text-[0.625rem]"
                />
                {subject.name}
                {subject.linked_user_id === userId && (
                  <span className="text-sm font-normal text-muted-foreground">
                    (you)
                  </span>
                )}
              </h2>
              <ul className="flex flex-col divide-y">
                {active.map((attribute) => (
                  <li
                    key={attribute.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2"
                  >
                    <span className="text-sm">{attributeLabel(attribute)}</span>
                    <Segmented
                      label={`What others see of ${subject.name}'s ${attribute.name}`}
                      options={options}
                      value={current(subject.id, attribute.id)}
                      onChange={(visibility) =>
                        set.mutate({
                          subjectId: subject.id,
                          attributeId: attribute.id,
                          visibility,
                        })
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        <p className="text-xs text-muted-foreground">
          Good to know: someone who knows a starting value can work out the
          others from the % changes. With “% only”, only{' '}
          {group.membersEditOwnSubjectOnly
            ? 'you'
            : 'you (or, for a participant without an account, those who log for it)'}{' '}
          can log or change these values.
        </p>
      </div>
    </>
  )
}
