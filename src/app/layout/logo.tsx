import { Link } from 'react-router'

import { cn } from '@/lib/utils'

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="my-metrics home"
      className={cn(
        'inline-flex items-baseline rounded-md text-lg tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
        className,
      )}
    >
      <span className="font-light text-muted-foreground">my</span>
      <span aria-hidden className="px-px font-light text-muted-foreground">
        ·
      </span>
      <span className="font-semibold">metrics</span>
    </Link>
  )
}
