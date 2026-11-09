import { Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { formatDateTime } from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { useLogEntry } from '@/features/entries/log-entry-context'
import { canLogFor } from '@/features/entries/permissions'
import {
  RECENT_ENTRIES_LIMIT,
  useRecentEntries,
} from '@/features/entries/use-entries'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'

// The group's latest entries on the group page, newest first. The dashboard
// (step 7) and the full table (step 8) come later.
export function EntriesSection({ group }: { group: GroupRow }) {
  const entries = useRecentEntries(group.id)
  const { openLogEntry } = useLogEntry()
  const { session } = useAuth()
  const userId = session?.user.id

  return (
    <section aria-labelledby="entries-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="entries-heading" className="font-heading text-lg font-semibold">
          Recent entries
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => openLogEntry(group.id)}
        >
          <Plus aria-hidden />
          Log entry
        </Button>
      </div>

      {entries.isPending && (
        <p className="text-sm text-muted-foreground">Loading entries…</p>
      )}
      {entries.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            The entries couldn't be loaded. Please reload the page.
          </AlertDescription>
        </Alert>
      )}
      {entries.data && entries.data.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing logged yet.</p>
      )}
      {entries.data && entries.data.length > 0 && (
        <ul
          aria-label="Recent entries"
          className="divide-y rounded-xl border bg-card"
        >
          {entries.data.map((entry) => {
            const editable =
              canLogFor(group, entry.subject, userId) &&
              !entry.attribute.archived_at
            return (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <SubjectAvatar
                  name={entry.subject.name}
                  color={entry.subject.color}
                  className="mt-0.5 size-8"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{entry.attribute.name}</span>
                    <span className="font-medium tabular-nums">
                      {formatValue(entry.value, entry.attribute)}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {entry.subject.name} ·{' '}
                    <time dateTime={entry.measured_at}>
                      {formatDateTime(entry.measured_at)}
                    </time>
                  </span>
                  {entry.comment && (
                    <p className="text-sm break-words">{entry.comment}</p>
                  )}
                </div>
                {editable && (
                  <Button asChild variant="ghost" size="icon">
                    <Link
                      to={`/logbooks/${group.id}/entries/${entry.id}/edit`}
                      aria-label={`Edit ${entry.attribute.name} of ${entry.subject.name}, ${formatDateTime(entry.measured_at)}`}
                    >
                      <Pencil aria-hidden />
                    </Link>
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {entries.data && entries.data.length === RECENT_ENTRIES_LIMIT && (
        <p className="text-sm text-muted-foreground">
          Showing the latest {RECENT_ENTRIES_LIMIT} entries.
        </p>
      )}
    </section>
  )
}
