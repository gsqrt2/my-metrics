import { cn } from 'cn'

// Dashed box marking where a feature's content will go.
export function Placeholder({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-48 items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}
