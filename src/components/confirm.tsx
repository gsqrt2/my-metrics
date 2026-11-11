import { Button } from '@/components/ui/button'

// An inline confirmation step: the question, then the action and Cancel.
export function Confirm({
  label,
  text,
  action,
  destructive = false,
  disabled = false,
  pending,
  children,
  onConfirm,
  onCancel,
}: {
  label: string
  text: string
  action: string
  destructive?: boolean
  pending: boolean
  // Extra content between the text and the buttons, e.g. a field to type.
  children?: React.ReactNode
  disabled?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-3 rounded-lg border p-3"
    >
      <p className="text-sm">{text}</p>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={pending || disabled}
          onClick={onConfirm}
        >
          {action}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
