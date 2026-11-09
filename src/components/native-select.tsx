import { cn } from 'cn'

// The browser's own <select>, styled like the text inputs. Native, so it's
// easy to use on phones. Its options take the popover colours, since some
// browsers otherwise draw them with the page's text colour on a white list,
// which is unreadable in dark mode.
export function NativeSelect({
  className,
  ...props
}: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30',
        '[&_option]:bg-popover [&_option]:text-popover-foreground',
        className,
      )}
      {...props}
    />
  )
}
