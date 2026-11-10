import { ArrowDown, ArrowUp, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { attributeDetails, attributeLabel } from '@/features/attributes/format'
import { SuggestedAttributes } from '@/features/attributes/suggested-attributes'
import {
  useAttributes,
  useReorderAttributes,
  type Attribute,
} from '@/features/attributes/use-attributes'
import { WithGroup } from '@/features/groups/group-page'
import { canEditGroup, type GroupRow } from '@/features/groups/types'

// FR-40 – FR-42: a group's attributes, shown as "metrics", for owners and
// editors to add, edit, reorder and archive.
export function AttributesPage() {
  return <WithGroup>{(group) => <ManageAttributes group={group} />}</WithGroup>
}

function ManageAttributes({ group }: { group: GroupRow }) {
  const attributes = useAttributes(group.id)
  const reorder = useReorderAttributes(group.id)
  const [showArchived, setShowArchived] = useState(false)
  // Suggestions show while there are no metrics, and stay for this visit once
  // one has been picked from them.
  const [suggesting, setSuggesting] = useState<boolean | null>(null)
  const groupPath = `/logbooks/${group.id}`
  const back = <BackLink to={groupPath}>{group.name}</BackLink>

  if (!canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title="Metrics"
          description="Only the logbook's owner and editors can manage metrics."
        />
        <Button asChild variant="outline">
          <Link to={groupPath}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }

  const active = attributes.data?.filter((a) => !a.archived_at) ?? []
  const archived = attributes.data?.filter((a) => a.archived_at) ?? []

  // Moves an active attribute one place up or down; archived ones keep their
  // place after the active ones.
  function move(index: number, by: -1 | 1) {
    const ids = active.map((a) => a.id)
    ;[ids[index], ids[index + by]] = [ids[index + by], ids[index]]
    reorder.mutate([...ids, ...archived.map((a) => a.id)], {
      onSuccess: () =>
        toast.success('Saved. The new order is shown everywhere.'),
    })
  }

  return (
    <>
      {back}
      <PageHeader
        title="Metrics"
        description={`What you measure in ${group.name}, in the order it's shown.`}
        actions={
          <Button asChild>
            <Link to={`${groupPath}/metrics/new`}>
              <Plus aria-hidden />
              Add metric
            </Link>
          </Button>
        }
      />
      <div className="flex max-w-2xl flex-col gap-4">
        {attributes.isPending && (
          <p className="text-sm text-muted-foreground">Loading metrics…</p>
        )}
        {(attributes.isError || reorder.isError) && (
          <Alert variant="destructive">
            <AlertDescription>
              {attributes.isError
                ? "The metrics couldn't be loaded. Please reload the page."
                : "The new order couldn't be saved. Please try again."}
            </AlertDescription>
          </Alert>
        )}
        {attributes.data && (suggesting ?? active.length === 0) && (
          <SuggestedAttributes
            groupId={group.id}
            existing={attributes.data}
            onAdded={() => setSuggesting(true)}
            onDone={active.length > 0 ? () => setSuggesting(false) : undefined}
          />
        )}
        {active.length > 0 && (
          <ul
            aria-label="Metrics"
            className="divide-y rounded-xl border bg-card"
          >
            {active.map((attribute, index) => (
              <AttributeItem
                key={attribute.id}
                attribute={attribute}
                groupId={group.id}
                onUp={index > 0 ? () => move(index, -1) : undefined}
                onDown={
                  index < active.length - 1 ? () => move(index, 1) : undefined
                }
              />
            ))}
          </ul>
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
                ? 'Hide archived metrics'
                : `Show archived metrics (${archived.length})`}
            </Button>
            {showArchived && (
              <ul
                aria-label="Archived metrics"
                className="divide-y rounded-xl border bg-card"
              >
                {archived.map((attribute) => (
                  <AttributeItem
                    key={attribute.id}
                    attribute={attribute}
                    groupId={group.id}
                  />
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  )
}

function AttributeItem({
  attribute,
  groupId,
  onUp,
  onDown,
}: {
  attribute: Attribute
  groupId: string
  onUp?: () => void
  onDown?: () => void
}) {
  const label = attributeLabel(attribute)
  const reorderable = onUp !== undefined || onDown !== undefined

  return (
    <li className="flex items-center gap-2 py-2 pr-2 pl-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium break-words">{label}</span>
          {attribute.archived_at && <Badge variant="outline">Archived</Badge>}
        </div>
        <span className="text-sm text-muted-foreground">
          {attributeDetails(attribute)}
        </span>
      </div>
      {reorderable && (
        <>
          <Button
            variant="ghost"
            size="icon"
            disabled={!onUp}
            onClick={onUp}
            aria-label={`Move ${attribute.name} up`}
          >
            <ArrowUp aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            disabled={!onDown}
            onClick={onDown}
            aria-label={`Move ${attribute.name} down`}
          >
            <ArrowDown aria-hidden />
          </Button>
        </>
      )}
      <Button asChild variant="ghost" size="icon">
        <Link
          to={`/logbooks/${groupId}/metrics/${attribute.id}/edit`}
          aria-label={`Edit ${attribute.name}`}
        >
          <Pencil aria-hidden />
        </Link>
      </Button>
    </li>
  )
}
