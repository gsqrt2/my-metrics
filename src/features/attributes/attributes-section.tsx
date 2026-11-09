import { Link } from 'react-router'

import { attributeLabel } from '@/features/attributes/format'
import { useAttributes } from '@/features/attributes/use-attributes'
import { canEditGroup, type GroupRow } from '@/features/groups/types'

// Compact row of the group's active attributes ("metrics") on the group page.
// Owners and editors manage them through Options → Metrics.
export function AttributesSection({ group }: { group: GroupRow }) {
  const attributes = useAttributes(group.id)
  const active = attributes.data?.filter((a) => !a.archived_at) ?? []

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
      {attributes.isError && (
        <p className="text-sm text-destructive">
          The metrics couldn't be loaded.
        </p>
      )}
      {attributes.data && active.length === 0 && (
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
      {active.length > 0 && (
        <ul aria-label="Metrics" className="flex flex-wrap gap-2">
          {active.map((attribute) => (
            <li
              key={attribute.id}
              className="inline-flex max-w-full items-center rounded-full border bg-card px-3 py-1 text-sm"
            >
              <span className="truncate">{attributeLabel(attribute)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
