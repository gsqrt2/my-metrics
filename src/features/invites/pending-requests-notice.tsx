import { Link } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { GroupRow } from '@/features/groups/types'
import { usePendingLinkRequests } from '@/features/invites/use-invites'

// FR-22: tells the owner, on the group page, that someone who joined is
// waiting to be linked to a participant.
export function PendingRequestsNotice({ group }: { group: GroupRow }) {
  const requests = usePendingLinkRequests(group.id)
  const count = requests.data?.length ?? 0
  if (count === 0) return null
  return (
    <Alert className="mb-6">
      <AlertDescription>
        {count === 1
          ? '1 person is waiting to be linked to a participant.'
          : `${count} people are waiting to be linked to a participant.`}{' '}
        <Link
          to={`/logbooks/${group.id}/invites`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          Review
        </Link>
      </AlertDescription>
    </Alert>
  )
}
