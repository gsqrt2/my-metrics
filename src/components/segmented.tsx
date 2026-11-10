import { cn } from 'cn'

// A small row of mutually exclusive choices, e.g. "By metric | By participant"
// or "Week | Month | Year". Each option is a toggle button.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string
  className?: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full flex-wrap self-start rounded-lg border p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'rounded-md px-3 py-1 text-sm transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
