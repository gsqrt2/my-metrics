import { Button } from '@/components/ui/button'

// An inline confirmation step: the question, then the action and a way back.
// Every "are you sure?" in the app uses it, so they look and work alike.
export function Confirm({
  label,
  text,
  action,
  cancelLabel = 'Cancel',
  destructive = false,
  disabled = false,
  pending,
  submit = false,
  children,
  onConfirm,
  onCancel,
}: {
  label: string
  text: string
  action: string
  // e.g. "Keep it" or "Keep editing", where that says more than "Cancel".
  cancelLabel?: string
  destructive?: boolean
  pending: boolean
  // The action submits the surrounding form (e.g. with a password field in
  // children, so Enter confirms too) instead of calling onConfirm.
  submit?: boolean
  // Extra content between the text and the buttons, e.g. a field to type.
  children?: React.ReactNode
  disabled?: boolean
  onConfirm?: () => void
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
          type={submit ? 'submit' : 'button'}
          size="sm"
          variant={destructive ? 'destructive' : 'default'}
          disabled={pending || disabled}
          onClick={submit ? undefined : onConfirm}
        >
          {action}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
      </div>
    </div>
  )
}
