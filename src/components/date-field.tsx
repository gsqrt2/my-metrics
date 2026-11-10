import { CalendarDays } from 'lucide-react'
import { useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { dayTextToIso, isoToDayText, parseTime } from '@/lib/dates'

// Dates are typed as dd/mm/yyyy and times as hh:mm, whatever the browser's
// language (the browser's own date inputs follow its language; decided
// 2026-11-10). The calendar button still opens the browser's date picker.

// The text box and calendar button. Reports yyyy-mm-dd, '' when empty, or
// null while the text isn't a real date.
function DateInput({
  id,
  label,
  initial,
  onChange,
  onBlur,
  min,
  max,
  invalid,
  describedBy,
}: {
  id: string
  label: string
  initial: string
  onChange: (iso: string | null, text: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  invalid?: boolean
  describedBy?: string
}) {
  const picker = useRef<HTMLInputElement>(null)
  const [text, setText] = useState(() => isoToDayText(initial) || initial)

  return (
    <div className="relative flex gap-2">
      <Input
        id={id}
        inputMode="decimal"
        placeholder="dd/mm/yyyy"
        autoComplete="off"
        value={text}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        onBlur={onBlur}
        onChange={(event) => {
          setText(event.target.value)
          onChange(dayTextToIso(event.target.value), event.target.value)
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="shrink-0"
        aria-label={`Pick ${label.toLowerCase()} from a calendar`}
        onClick={() => {
          try {
            picker.current?.showPicker()
          } catch {
            picker.current?.focus()
          }
        }}
      >
        <CalendarDays aria-hidden />
      </Button>
      {/* The browser's picker, opened only by the calendar button. */}
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
        value={dayTextToIso(text) || ''}
        min={min}
        max={max}
        onChange={(event) => {
          const iso = event.target.value
          setText(isoToDayText(iso))
          onChange(iso, isoToDayText(iso))
        }}
      />
    </div>
  )
}

function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} className="text-sm text-destructive">
      {error}
    </p>
  ) : null
}

// A calendar date. value and onChange use yyyy-mm-dd, '' for no date, or,
// while the text isn't a real date, the text as typed, so validation can say
// so. The text is kept from the first value: the forms don't reset it.
export function DateField({
  id,
  label,
  value,
  onChange,
  onBlur,
  min,
  max,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  min?: string
  max?: string
  error?: string
}) {
  const errorId = `${id}-error`
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <DateInput
        id={id}
        label={label}
        initial={value}
        min={min}
        max={max}
        invalid={!!error}
        describedBy={error ? errorId : undefined}
        onBlur={onBlur}
        onChange={(iso, text) => onChange(iso ?? text)}
      />
      <FieldError id={errorId} error={error} />
    </div>
  )
}

// A date and time. value and onChange use yyyy-mm-ddThh:mm (as a
// datetime-local input would), or something that isn't, while either part
// isn't valid.
export function DateTimeField({
  id,
  label,
  value,
  onChange,
  max,
  error,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  max?: string
  error?: string
}) {
  const [initialDay, initialTime = ''] = value.split('T')
  const [day, setDay] = useState(initialDay)
  const [time, setTime] = useState(initialTime)
  const errorId = `${id}-error`
  const emit = (nextDay: string, nextTime: string) =>
    onChange(`${nextDay}T${parseTime(nextTime) ?? nextTime}`)

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-2 text-sm leading-none font-medium">{label}</legend>
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-date`} className="sr-only">
            Date
          </Label>
          <DateInput
            id={`${id}-date`}
            label="Date"
            initial={initialDay}
            max={max?.split('T')[0]}
            invalid={!!error}
            onChange={(iso, text) => {
              const next = iso || text
              setDay(next)
              emit(next, time)
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor={`${id}-time`} className="sr-only">
            Time
          </Label>
          <Input
            id={`${id}-time`}
            inputMode="decimal"
            placeholder="hh:mm"
            autoComplete="off"
            value={time}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setTime(event.target.value)
              emit(day, event.target.value)
            }}
          />
        </div>
      </div>
      <FieldError id={errorId} error={error} />
    </fieldset>
  )
}
