import { Plus } from 'lucide-react'
import { useMatch } from 'react-router'

import { Button } from '@/components/ui/button'
import { useLogEntry } from '@/features/entries/log-entry-context'
import { cn } from '@/lib/utils'

// Primary action: opens the "Log entry" form. On a logbook's pages it starts
// in that logbook; elsewhere in the last one used (plan step 6).
export function LogEntryButton({
  variant = 'full',
  className,
}: {
  variant?: 'full' | 'floating'
  className?: string
}) {
  const { openLogEntry } = useLogEntry()
  const match = useMatch('/logbooks/:groupId/*')
  const groupId =
    match?.params.groupId && match.params.groupId !== 'new'
      ? match.params.groupId
      : undefined
  const open = () => openLogEntry(groupId)

  if (variant === 'floating') {
    return (
      <Button
        size="icon-lg"
        aria-label="Log entry"
        className={cn('size-14 rounded-full shadow-lg', className)}
        onClick={open}
      >
        <Plus className="size-6" aria-hidden />
      </Button>
    )
  }

  return (
    <Button size="lg" className={cn('w-full', className)} onClick={open}>
      <Plus data-icon="inline-start" aria-hidden />
      Log entry
    </Button>
  )
}
