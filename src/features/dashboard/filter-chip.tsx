import { cn } from 'cn'

const chip =
  'inline-flex max-w-full items-center gap-2 rounded-full border py-1 text-sm'

// A chip in the group page's participant or metric row. When the row filters
// the charts it's a toggle button; otherwise it's a plain label.
export function FilterChip({
  interactive,
  pressed,
  title,
  onToggle,
  withAvatar = false,
  children,
}: {
  interactive: boolean
  pressed: boolean
  title: string
  onToggle: () => void
  withAvatar?: boolean
  children: React.ReactNode
}) {
  const padding = withAvatar ? 'pr-3 pl-1' : 'px-3'
  if (!interactive) {
    return <span className={cn(chip, padding, 'bg-card')}>{children}</span>
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      title={title}
      onClick={onToggle}
      className={cn(
        chip,
        padding,
        'transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        pressed
          ? 'bg-card'
          : 'border-dashed bg-transparent text-muted-foreground [&_[data-avatar]]:opacity-40',
      )}
    >
      {children}
    </button>
  )
}

export function ShowAllButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm font-medium underline underline-offset-4"
    >
      Show all
    </button>
  )
}
