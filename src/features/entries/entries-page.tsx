import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { BackLink } from '@/app/layout/back-link'
import { PageHeader } from '@/app/layout/page-header'
import { NativeSelect } from '@/components/native-select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { attributeLabel } from '@/features/attributes/format'
import { useAttributes } from '@/features/attributes/use-attributes'
import { useAuth } from '@/features/auth/use-auth'
import { formatDateTime } from '@/features/entries/datetime'
import { formatValue } from '@/features/entries/format'
import { canLogFor } from '@/features/entries/permissions'
import {
  ENTRIES_PAGE_SIZE,
  useEntryTable,
  type Entry,
  type EntrySort,
} from '@/features/entries/use-entries'
import { WithGroup } from '@/features/groups/group-page'
import type { GroupRow } from '@/features/groups/types'
import { SubjectAvatar } from '@/features/subjects/subject-avatar'
import { useSubjects } from '@/features/subjects/use-subjects'

// FR-65: all of a group's entries, filtered by participant and metric, and
// sorted by time, or by value once one metric is chosen (values of different
// metrics don't compare).
export function EntriesPage() {
  return <WithGroup>{(group) => <EntryTable group={group} />}</WithGroup>
}

function EntryTable({ group }: { group: GroupRow }) {
  const { session } = useAuth()
  const subjects = useSubjects(group.id)
  const attributes = useAttributes(group.id)
  const [subjectId, setSubjectId] = useState('')
  const [attributeId, setAttributeId] = useState('')
  const [sort, setSort] = useState<EntrySort>('newest')
  const [page, setPage] = useState(0)
  const table = useEntryTable(group.id, {
    subjectId: subjectId || undefined,
    attributeId: attributeId || undefined,
    sort,
    page,
  })

  const canEdit = (entry: Entry) =>
    canLogFor(group, entry.subject, session?.user.id) &&
    !entry.attribute.archived_at
  const pages = Math.max(
    1,
    Math.ceil((table.data?.total ?? 0) / ENTRIES_PAGE_SIZE),
  )
  const byValue = sort === 'highest' || sort === 'lowest'
  // Any change of filter or order starts again at the first page.
  const choose = (apply: () => void) => {
    apply()
    setPage(0)
  }

  return (
    <>
      <BackLink to={`/logbooks/${group.id}`}>{group.name}</BackLink>
      <PageHeader title="All entries" description={group.name} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="entries-subject">Participant</Label>
          <NativeSelect
            id="entries-subject"
            value={subjectId}
            onChange={(e) => choose(() => setSubjectId(e.target.value))}
          >
            <option value="">All participants</option>
            {subjects.data?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.archived_at ? ' (archived)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entries-attribute">Metric</Label>
          <NativeSelect
            id="entries-attribute"
            value={attributeId}
            onChange={(e) =>
              choose(() => {
                setAttributeId(e.target.value)
                if (!e.target.value && byValue) setSort('newest')
              })
            }
          >
            <option value="">All metrics</option>
            {attributes.data?.map((a) => (
              <option key={a.id} value={a.id}>
                {attributeLabel(a)}
                {a.archived_at ? ' (archived)' : ''}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="entries-sort">Order</Label>
          <NativeSelect
            id="entries-sort"
            value={sort}
            onChange={(e) => choose(() => setSort(e.target.value as EntrySort))}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest" disabled={!attributeId}>
              Highest value first{attributeId ? '' : ' (choose a metric)'}
            </option>
            <option value="lowest" disabled={!attributeId}>
              Lowest value first{attributeId ? '' : ' (choose a metric)'}
            </option>
          </NativeSelect>
        </div>
      </div>

      {table.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            The entries couldn't be loaded. Please reload the page.
          </AlertDescription>
        </Alert>
      )}
      {table.isPending && (
        <p className="text-sm text-muted-foreground">Loading entries…</p>
      )}
      {table.data && table.data.total === 0 && (
        <p className="text-sm text-muted-foreground">
          {subjectId || attributeId
            ? 'No entries match these filters.'
            : 'Nothing logged yet.'}
        </p>
      )}
      {table.data && table.data.total > 0 && (
        <>
          <p className="mb-2 text-sm text-muted-foreground" role="status">
            {table.data.total === 1 ? '1 entry' : `${table.data.total} entries`}
          </p>
          {/* Phones: one entry per row, nothing to scroll sideways. */}
          <ul
            aria-label="Entries"
            className="divide-y rounded-xl border bg-card sm:hidden"
          >
            {table.data.entries.map((entry) => (
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
                {canEdit(entry) && (
                  <EditLink groupId={group.id} entry={entry} />
                )}
              </li>
            ))}
          </ul>
          {/* Wider screens: a table. */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card sm:block">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    When
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Participant
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Metric
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Value
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Comment
                  </th>
                  <th scope="col" className="w-12 px-2 py-2">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {table.data.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-2 whitespace-nowrap tabular-nums">
                      <time dateTime={entry.measured_at}>
                        {formatDateTime(entry.measured_at)}
                      </time>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-2">
                        <SubjectAvatar
                          name={entry.subject.name}
                          color={entry.subject.color}
                          className="size-6 text-[0.625rem]"
                        />
                        {entry.subject.name}
                      </span>
                    </td>
                    <td className="px-4 py-2">{entry.attribute.name}</td>
                    <td className="px-4 py-2 text-right font-medium whitespace-nowrap tabular-nums">
                      {formatValue(entry.value, entry.attribute)}
                    </td>
                    <td className="max-w-64 px-4 py-2 break-words text-muted-foreground">
                      {entry.comment}
                    </td>
                    <td className="px-2 py-1">
                      {canEdit(entry) && (
                        <EditLink groupId={group.id} entry={entry} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <nav
              aria-label="Pages"
              className="mt-4 flex items-center justify-center gap-3"
            >
              <Button
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Newer
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page + 1} of {pages}
              </span>
              <Button
                variant="outline"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Older
              </Button>
            </nav>
          )}
        </>
      )}
    </>
  )
}

function EditLink({ groupId, entry }: { groupId: string; entry: Entry }) {
  return (
    <Button asChild variant="ghost" size="icon">
      <Link
        to={`/logbooks/${groupId}/entries/${entry.id}/edit`}
        aria-label={`Edit ${entry.attribute.name} of ${entry.subject.name}, ${formatDateTime(entry.measured_at)}`}
      >
        <Pencil aria-hidden />
      </Link>
    </Button>
  )
}
