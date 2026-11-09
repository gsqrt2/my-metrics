import { useAuth } from '@/features/auth/use-auth'
import { FilterChip, ShowAllButton } from '@/features/dashboard/filter-chip'
import {
  chipTitle,
  isSelected,
  toggleSelection,
  type Selection,
} from '@/features/dashboard/selection'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import type { Subject } from '@/features/subjects/use-subjects'

// The group's active subjects on the group page. In the "by metric" chart
// view they filter the charts (all at first; tap one to focus, tap more to
// add, "Show all" to go back). Owners and editors manage subjects through
// Options → Participants.
export function SubjectsSection({
  subjects,
  isError,
  filters,
  selected,
  onSelectedChange,
}: {
  subjects: Subject[] | undefined
  isError: boolean
  filters: boolean
  selected: Selection
  onSelectedChange: (selected: Selection) => void
}) {
  const { session } = useAuth()

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
      {isError && (
        <p className="text-sm text-destructive">
          The participants couldn't be loaded.
        </p>
      )}
      {subjects && subjects.length === 0 && (
        <p className="text-sm text-muted-foreground">None yet.</p>
      )}
      {subjects && subjects.length > 0 && (
        <ul aria-label="Participants" className="flex flex-wrap gap-2">
          {subjects.map((subject) => {
            const on = !filters || isSelected(selected, subject.id)
            return (
              <li key={subject.id} className="max-w-full">
                <FilterChip
                  interactive={filters}
                  pressed={on}
                  withAvatar
                  title={chipTitle(subject.name, selected === null, on)}
                  onToggle={() =>
                    onSelectedChange(
                      toggleSelection(selected, subject.id, subjects.length),
                    )
                  }
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
                </FilterChip>
              </li>
            )
          })}
        </ul>
      )}
      {filters && selected !== null && (
        <ShowAllButton onClick={() => onSelectedChange(null)} />
      )}
    </section>
  )
}
