import { Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { AttributeForm } from '@/features/attributes/attribute-form'
import { toAttributeForm } from '@/features/attributes/schemas'
import {
  attributeErrorMessage,
  useAttributes,
  useDeleteAttribute,
  useUpdateAttribute,
  type Attribute,
} from '@/features/attributes/use-attributes'
import { useAttributeEntryCount } from '@/features/entries/use-entries'
import { WithGroup } from '@/features/groups/group-page'
import {
  canEditGroup,
  cantManageText,
  type GroupRow,
} from '@/features/groups/types'

// FR-40 – FR-42: edit, archive, restore and delete an attribute ("metric").
export function EditAttributePage() {
  return <WithGroup>{(group) => <FindAttribute group={group} />}</WithGroup>
}

function FindAttribute({ group }: { group: GroupRow }) {
  const { attributeId } = useParams()
  const attributes = useAttributes(group.id)
  const metricsPath = `/logbooks/${group.id}/metrics`
  const back = <BackLink to={metricsPath}>Metrics</BackLink>

  if (attributes.isPending) return null
  const attribute = attributes.data?.find((a) => a.id === attributeId)

  if (!attribute || !canEditGroup(group)) {
    return (
      <>
        {back}
        <PageHeader
          title={attribute ? 'Edit metric' : 'Metric not found'}
          description={
            attribute
              ? cantManageText(
                  group,
                  "Only the logbook's owner and editors can change metrics.",
                )
              : "It doesn't exist in this logbook."
          }
        />
        <Button asChild variant="outline">
          <Link to={`/logbooks/${group.id}`}>Back to {group.name}</Link>
        </Button>
      </>
    )
  }
  return (
    <EditAttribute
      attribute={attribute}
      isOwner={group.role === 'owner'}
      metricsPath={metricsPath}
      back={back}
    />
  )
}

function EditAttribute({
  attribute,
  isOwner,
  metricsPath,
  back,
}: {
  attribute: Attribute
  isOwner: boolean
  metricsPath: string
  back: React.ReactNode
}) {
  const entryCount = useAttributeEntryCount(attribute.id).data ?? 0
  const entries = entryCount === 1 ? '1 entry' : `${entryCount} entries`
  const navigate = useNavigate()
  const update = useUpdateAttribute(attribute)
  const archive = useUpdateAttribute(attribute)
  const remove = useDeleteAttribute(attribute)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isArchived = attribute.archived_at !== null
  const done = { onSuccess: () => navigate(metricsPath) }

  return (
    <>
      {back}
      <PageHeader title="Edit metric" description={attribute.name} />
      <div className="flex max-w-xl flex-col gap-8">
        <AttributeForm
          defaultValues={toAttributeForm(attribute)}
          entryCount={entryCount}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          cancelTo={metricsPath}
          isPending={update.isPending}
          error={update.error ? attributeErrorMessage(update.error) : undefined}
          onSubmit={(fields) => update.mutate(fields, done)}
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
              ? 'This metric is hidden and nothing can be logged for it. Restore it to log again.'
              : 'Hides this metric and stops new entries for it. Its entries are kept, and you can restore it at any time.'}
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
                done,
              )
            }
          >
            {isArchived ? (
              <>
                <ArchiveRestore aria-hidden />
                Restore metric
              </>
            ) : (
              <>
                <Archive aria-hidden />
                Archive metric
              </>
            )}
          </Button>
        </section>

        <Separator />

        <section
          aria-labelledby="delete-heading"
          className="flex flex-col gap-3"
        >
          <h2 id="delete-heading" className="font-heading font-semibold">
            Delete
          </h2>
          <p className="text-sm text-muted-foreground">
            {entryCount === 0
              ? 'Removes this metric for good. Nothing has been logged for it yet.'
              : isOwner
                ? `Removes this metric for good, together with its ${entries}. To keep them, archive it instead.`
                : `This metric has ${entries}, so only the logbook's owner can delete it. You can archive it instead.`}
          </p>
          {remove.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Deleting failed. Please try again.
              </AlertDescription>
            </Alert>
          )}
          {confirmingDelete ? (
            <div
              role="group"
              aria-label="Confirm deleting"
              className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
            >
              <p className="text-sm font-medium">
                {entryCount === 0
                  ? `Delete “${attribute.name}”? This can't be undone.`
                  : `Delete “${attribute.name}” and its ${entries}? This can't be undone.`}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="destructive"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(undefined, done)}
                >
                  <Trash2 aria-hidden />
                  Delete for good
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Keep it
                </Button>
              </div>
            </div>
          ) : (
            (entryCount === 0 || isOwner) && (
              <Button
                variant="outline"
                className="self-start text-destructive"
                onClick={() => setConfirmingDelete(true)}
              >
                <Trash2 aria-hidden />
                Delete metric…
              </Button>
            )
          )}
        </section>
      </div>
    </>
  )
}
