import { z } from 'zod'

import { todayIso } from '@/features/subjects/age'
import { SUBJECT_COLORS } from '@/features/subjects/colors'
import { DATE_FORMAT_MESSAGE, isIsoDay } from '@/lib/dates'
import type { Tables } from '@/types/database'

// Matches the check constraints on public.subjects (FR-80).
export const MAX_SUBJECT_NAME_LENGTH = 80
export const MIN_BIRTHDATE = '1900-01-01'

const colorValues = SUBJECT_COLORS.map((color) => color.value) as [
  (typeof SUBJECT_COLORS)[number]['value'],
  ...(typeof SUBJECT_COLORS)[number]['value'][],
]

// `today` is a parameter so "not in the future" is testable.
export function subjectSchema(today = todayIso()) {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(
        MAX_SUBJECT_NAME_LENGTH,
        `Use at most ${MAX_SUBJECT_NAME_LENGTH} characters.`,
      ),
    // Optional; ISO dates (yyyy-mm-dd) compare as text.
    birthdate: z
      .string()
      .refine((date) => date === '' || isIsoDay(date), DATE_FORMAT_MESSAGE)
      .refine(
        (date) => date === '' || !isIsoDay(date) || date >= MIN_BIRTHDATE,
        'Use a date in 1900 or later.',
      )
      .refine(
        (date) => date === '' || !isIsoDay(date) || date <= today,
        "A birthdate can't be in the future.",
      ),
    color: z.enum(colorValues),
  })
}

export type SubjectFormValues = z.input<ReturnType<typeof subjectSchema>>
export type SubjectFormOutput = z.output<ReturnType<typeof subjectSchema>>
export type SubjectFields = Pick<
  Tables<'subjects'>,
  'name' | 'birthdate' | 'color'
>

export function toSubjectForm(subject: SubjectFields): SubjectFormValues {
  return {
    name: subject.name,
    birthdate: subject.birthdate ?? '',
    color: subject.color,
  }
}

export function toSubjectRow(values: SubjectFormOutput): SubjectFields {
  return {
    name: values.name,
    birthdate: values.birthdate || null,
    color: values.color,
  }
}
