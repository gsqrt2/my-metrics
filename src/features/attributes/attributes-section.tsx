import { Link } from 'react-router'

import { attributeLabel } from '@/features/attributes/format'
import type { Attribute } from '@/features/attributes/use-attributes'
import { FilterChip, ShowAllButton } from '@/features/dashboard/filter-chip'
import {
  chipTitle,
  isSelected,
  toggleSelection,
  type Selection,
} from '@/features/dashboard/selection'
import { canEditGroup, type GroupRow } from '@/features/groups/types'

// The group's active attributes ("metrics") on the group page. In the "by
// participant" chart view they filter the charts, like the participant chips
// do in the "by metric" view. Owners and editors manage them through
// Options → Metrics.
export function AttributesSection({
  group,
  attributes,
  isError,
  filters,
  selected,
  onSelectedChange,
}: {
  group: GroupRow
  attributes: Attribute[] | undefined
  isError: boolean
  filters: boolean
  selected: Selection
  onSelectedChange: (selected: Selection) => void
}) {
  return (
    <section
      aria-labelledby="metrics-heading"
      className="flex flex-wrap items-center gap-x-4 gap-y-3"
    >
      <h2
        id="metrics-heading"
        className="text-sm font-medium text-muted-foreground"
      >
        Metrics
      </h2>
      {isError && (
        <p className="text-sm text-destructive">
          The metrics couldn't be loaded.
        </p>
      )}
      {attributes && attributes.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {canEditGroup(group) ? (
            <>
              None yet.{' '}
              <Link
                to={`/logbooks/${group.id}/metrics`}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Choose what to measure
              </Link>
            </>
          ) : (
            'None yet.'
          )}
        </p>
      )}
      {attributes && attributes.length > 0 && (
        <ul aria-label="Metrics" className="flex flex-wrap gap-2">
          {attributes.map((attribute) => {
            const on = !filters || isSelected(selected, attribute.id)
            return (
              <li key={attribute.id} className="max-w-full">
                <FilterChip
                  interactive={filters}
                  pressed={on}
                  title={chipTitle(attribute.name, selected === null, on)}
                  onToggle={() =>
                    onSelectedChange(
                      toggleSelection(
                        selected,
                        attribute.id,
                        attributes.length,
                      ),
                    )
                  }
                >
                  <span className="truncate">{attributeLabel(attribute)}</span>
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
