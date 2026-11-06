import { Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Primary action. Opens quick entry once logging exists (plan step 6).
export function LogEntryButton({
  variant = 'full',
  className,
}: {
  variant?: 'full' | 'floating'
  className?: string
}) {
  if (variant === 'floating') {
    return (
      <Button
        size="icon-lg"
        aria-label="Log entry"
        className={cn('size-14 rounded-full shadow-lg', className)}
      >
        <Plus className="size-6" aria-hidden />
      </Button>
    )
  }

  return (
    <Button size="lg" className={cn('w-full', className)}>
      <Plus data-icon="inline-start" aria-hidden />
      Log entry
    </Button>
  )
}
