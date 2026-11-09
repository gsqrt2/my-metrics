import { ChevronLeft } from 'lucide-react'
import { Link } from 'react-router'

// "Up one level" link shown above a page's title, e.g. from a group back to
// the group list, so phones don't need the menu for it.
export function BackLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="mb-3 -ml-1 inline-flex max-w-full items-center gap-1 rounded-md py-1 pr-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChevronLeft className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{children}</span>
    </Link>
  )
}
