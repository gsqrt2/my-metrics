import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  trackMyselfErrorMessage,
  useTrackMyself,
} from '@/features/subjects/use-subjects'

// Backlog: for members who aren't a participant yet (the logbook's creator,
// or someone who joined to watch). Shown where the participants are listed.
export function TrackMyselfButton({
  groupId,
  groupName,
}: {
  groupId: string
  groupName: string
}) {
  const track = useTrackMyself(groupId)
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={track.isPending}
      onClick={() =>
        track.mutate(undefined, {
          onSuccess: () =>
            toast.success(`You're now a participant in ${groupName}.`),
          onError: (error) => toast.error(trackMyselfErrorMessage(error)),
        })
      }
    >
      <UserPlus aria-hidden />
      {track.isPending ? 'Adding…' : 'Track myself here'}
    </Button>
  )
}
