import { cn } from 'cn'

import {
  subjectColorVar,
  subjectInkColor,
  type SubjectColor,
} from '@/features/subjects/colors'
import { initials } from '@/features/subjects/initials'

// A subject's colour with their initials. The name is always shown next to
// it, so the colour is never the only way to tell subjects apart.
export function SubjectAvatar({
  name,
  color,
  className,
}: {
  name: string
  color: SubjectColor
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
        className,
      )}
      style={{
        backgroundColor: subjectColorVar(color),
        color: subjectInkColor(color),
      }}
    >
      {initials(name)}
    </span>
  )
}
