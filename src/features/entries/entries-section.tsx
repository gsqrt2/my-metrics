import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/use-auth'
import { formatDateTime } from '@/features/entries/datetime'
import { EntryValue } from '@/features/entries/entry-value'
import { useLogEntry } from '@/features/entries/log-entry-context'
import { canLogFor } from '@/features/entries/permissions'
import { useEntryRows } from '@/features/entries/use-entry-rows'
import { RECENT_ENTRIES_LIMIT } from '@/features/entries/use-entries'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'

// Shown at first; the rest of the latest entries on request.
const INITIAL_COUNT = 5

// The group's latest entries on the group page, newest first, below the
// charts: secondary to them. The full table comes in step 8.
export function EntriesSection({ group }: { group: GroupRow }) {
  const rows = useEntryRows(group.id, {
    sort: 'newest',
    pageSize: RECENT_ENTRIES_LIMIT,
    page: 0,
  })
  const entries = { ...rows, data: rows.data?.entries }
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? entries.data : entries.data?.slice(0, INITIAL_COUNT)
  const { openLogEntry } = useLogEntry()
  const { session } = useAuth()
  const userId = session?.user.id

  return (
    <section aria-labelledby="entries-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="entries-heading" className="font-heading font-semibold">
          Recent entries
        </h2>
        {!group.isArchived && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => openLogEntry(group.id)}
          >
            <Plus aria-hidden />
            Log entry
          </Button>
        )}
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
          {shown!.map((entry) => {
            // Values hidden from the viewer (FR-43) can't be edited by them.
            const editable =
              canLogFor(group, entry.subject, userId) &&
              !entry.attribute.archived_at &&
              entry.value !== null
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
                    <EntryValue
                      value={entry.value}
                      pctChange={entry.pct_change}
                      attribute={entry.attribute}
                    />
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
      {entries.data && entries.data.length > INITIAL_COUNT && (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          aria-expanded={showAll}
          onClick={() => setShowAll((show) => !show)}
        >
          {showAll
            ? 'Show fewer'
            : `Show more (${entries.data.length - INITIAL_COUNT}${
                entries.data.length === RECENT_ENTRIES_LIMIT ? '+' : ''
              })`}
        </Button>
      )}
      {entries.data && entries.data.length > 0 && (
        <Link
          to={`/logbooks/${group.id}/entries`}
          className="self-start text-sm font-medium underline underline-offset-4"
        >
          All entries, with filters and sorting
        </Link>
      )}
      {showAll && entries.data?.length === RECENT_ENTRIES_LIMIT && (
        <p className="text-sm text-muted-foreground">
          Showing the latest {RECENT_ENTRIES_LIMIT} entries.
        </p>
      )}
    </section>
  )
}
