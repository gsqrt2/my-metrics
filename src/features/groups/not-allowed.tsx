import { Link } from 'react-router'

import { PageHeader } from '@/app/layout/page-header'
import { Button } from '@/components/ui/button'
import type { GroupRow } from '@/features/groups/types'

// A logbook page the user can't use (their role, an archived logbook) or
// whose item doesn't exist: why, and the way back to the logbook.
export function NotAllowed({
  group,
  back,
  title,
  description,
}: {
  group: GroupRow
  // The page's usual back link.
  back: React.ReactNode
  title: string
  description: string
}) {
  return (
    <>
      {back}
      <PageHeader title={title} description={description} />
      <Button asChild variant="outline">
        <Link to={`/logbooks/${group.id}`}>Back to {group.name}</Link>
      </Button>
    </>
  )
}
