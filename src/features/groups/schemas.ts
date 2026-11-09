import { z } from 'zod'

import type { Tables } from '@/types/database'

// Match the check constraints on public.groups (FR-80).
export const MAX_GROUP_NAME_LENGTH = 80
export const MAX_GROUP_DESCRIPTION_LENGTH = 500

export const groupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a name.')
      .max(
        MAX_GROUP_NAME_LENGTH,
        `Use at most ${MAX_GROUP_NAME_LENGTH} characters.`,
      ),
    description: z
      .string()
      .trim()
      .max(
        MAX_GROUP_DESCRIPTION_LENGTH,
        `Use at most ${MAX_GROUP_DESCRIPTION_LENGTH} characters.`,
      ),
    // FR-15: an optional start and end date, both or neither.
    hasDuration: z.boolean(),
    startsOn: z.string(),
    endsOn: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.hasDuration) return
    if (!values.startsOn) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a start date.',
        path: ['startsOn'],
      })
    }
    if (!values.endsOn) {
      ctx.addIssue({
        code: 'custom',
        message: 'Choose an end date.',
        path: ['endsOn'],
      })
    }
    // ISO dates (yyyy-mm-dd) sort as text.
    if (values.startsOn && values.endsOn && values.endsOn < values.startsOn) {
      ctx.addIssue({
        code: 'custom',
        message: "The end date can't be before the start date.",
        path: ['endsOn'],
      })
    }
  })

export type GroupFormValues = z.input<typeof groupSchema>
export type GroupFormOutput = z.output<typeof groupSchema>

export type GroupFields = Pick<
  Tables<'groups'>,
  'name' | 'description' | 'starts_on' | 'ends_on'
>

export const emptyGroupForm: GroupFormValues = {
  name: '',
  description: '',
  hasDuration: false,
  startsOn: '',
  endsOn: '',
}

export function toGroupForm(group: GroupFields): GroupFormValues {
  return {
    name: group.name,
    description: group.description ?? '',
    hasDuration: group.starts_on !== null,
    startsOn: group.starts_on ?? '',
    endsOn: group.ends_on ?? '',
  }
}

// Parsed (trimmed) form values → the columns saved in public.groups.
export function toGroupRow(values: GroupFormOutput): GroupFields {
  return {
    name: values.name,
    description: values.description || null,
    starts_on: values.hasDuration ? values.startsOn : null,
    ends_on: values.hasDuration ? values.endsOn : null,
  }
}
