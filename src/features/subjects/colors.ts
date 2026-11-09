import type { Enums } from '@/types/database'

export type SubjectColor = Enums<'subject_color'>

// The categorical palette in its fixed order, the same as the subject_color
// enum. The order keeps neighbouring colours apart for colour-blind viewers;
// the light and dark values are the --subject-* tokens in index.css.
export const SUBJECT_COLORS: { value: SubjectColor; label: string }[] = [
  { value: 'blue', label: 'Blue' },
  { value: 'orange', label: 'Orange' },
  { value: 'aqua', label: 'Aqua' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'magenta', label: 'Magenta' },
  { value: 'green', label: 'Green' },
  { value: 'violet', label: 'Violet' },
  { value: 'red', label: 'Red' },
]

export function subjectColorVar(color: SubjectColor) {
  return `var(--subject-${color})`
}

// Text on a colour fill: white, except dark ink on yellow for contrast.
export function subjectInkColor(color: SubjectColor) {
  return color === 'yellow' ? '#0b0b0b' : '#ffffff'
}

// The colour a new subject starts with: the one used least in its group,
// earliest in the palette on a tie. Same rule as the set_subject_defaults trigger.
export function nextSubjectColor(used: SubjectColor[]): SubjectColor {
  const count = (color: SubjectColor) => used.filter((c) => c === color).length
  return SUBJECT_COLORS.reduce((best, color) =>
    count(color.value) < count(best.value) ? color : best,
  ).value
}
