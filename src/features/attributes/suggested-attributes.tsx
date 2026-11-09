import { Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { attributeLabel } from '@/features/attributes/format'
import { SUGGESTED_ATTRIBUTES } from '@/features/attributes/suggestions'
import {
  attributeErrorMessage,
  useCreateAttribute,
  type Attribute,
} from '@/features/attributes/use-attributes'

// FR-13: the empty state of a logbook without metrics. Each suggestion is
// added with one tap; "Custom metric" opens the full form. It stays open after
// the first pick, so several can be added in a row.
export function SuggestedAttributes({
  groupId,
  existing,
  onAdded,
  onDone,
}: {
  groupId: string
  existing: Pick<Attribute, 'name'>[]
  onAdded: () => void
  onDone?: () => void
}) {
  const create = useCreateAttribute(groupId)
  const taken = new Set(existing.map((a) => a.name.trim().toLowerCase()))
  const suggestions = SUGGESTED_ATTRIBUTES.filter(
    (s) => !taken.has(s.name.toLowerCase()),
  )

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-dashed p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading font-semibold">
          {existing.length === 0 ? 'No metrics yet' : 'Suggested metrics'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Pick what to measure. You can change the details afterwards.
        </p>
      </div>
      {create.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            {attributeErrorMessage(create.error)}
          </AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <Button
            key={suggestion.name}
            variant="outline"
            size="sm"
            disabled={create.isPending}
            onClick={() => create.mutate(suggestion, { onSuccess: onAdded })}
          >
            <Plus aria-hidden />
            {attributeLabel(suggestion)}
          </Button>
        ))}
        <Button asChild variant="ghost" size="sm">
          <Link to={`/logbooks/${groupId}/metrics/new`}>Custom metric…</Link>
        </Button>
        {onDone && (
          <Button variant="ghost" size="sm" onClick={onDone}>
            Done
          </Button>
        )}
      </div>
    </div>
  )
}
