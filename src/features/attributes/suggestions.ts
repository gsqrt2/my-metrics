import type { AttributeFields } from '@/features/attributes/schemas'

// FR-13: offered while a logbook has no metrics yet. Each can be added with
// one tap and edited afterwards. Directions are neutral, since what's "better"
// depends on the logbook (a growing child vs. a diet).
export const SUGGESTED_ATTRIBUTES: AttributeFields[] = [
  {
    name: 'Weight',
    unit: 'kg',
    precision: 1,
    direction: 'neutral',
    min_value: 0,
    max_value: null,
  },
  {
    name: 'Height',
    unit: 'cm',
    precision: 1,
    direction: 'neutral',
    min_value: 0,
    max_value: null,
  },
  {
    name: 'Waist',
    unit: 'cm',
    precision: 1,
    direction: 'neutral',
    min_value: 0,
    max_value: null,
  },
  {
    name: 'Body fat',
    unit: '%',
    precision: 1,
    direction: 'neutral',
    min_value: 0,
    max_value: 100,
  },
  {
    name: 'Resting heart rate',
    unit: 'bpm',
    precision: 0,
    direction: 'neutral',
    min_value: 0,
    max_value: null,
  },
]
