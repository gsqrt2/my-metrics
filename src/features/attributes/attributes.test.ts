import { describe, expect, it } from 'vitest'

import { attributeDetails, attributeLabel } from '@/features/attributes/format'
import {
  attributeSchema,
  emptyAttributeForm,
  toAttributeForm,
  toAttributeRow,
  type AttributeFormValues,
} from '@/features/attributes/schemas'
import { formatDecimal, parseDecimal } from '@/lib/numbers'

describe('parseDecimal', () => {
  it('reads dot and comma decimals', () => {
    expect(parseDecimal('72.5')).toBe(72.5)
    expect(parseDecimal(' 72,5 ')).toBe(72.5)
    expect(parseDecimal('-3')).toBe(-3)
    expect(parseDecimal('.5')).toBe(0.5)
    expect(parseDecimal('0')).toBe(0)
  })

  it('treats empty input as no number', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('   ')).toBeNull()
  })

  it('rejects anything else, including thousands separators', () => {
    expect(parseDecimal('abc')).toBeNaN()
    expect(parseDecimal('1,234.5')).toBeNaN()
    expect(parseDecimal('72 kg')).toBeNaN()
  })
})

describe('formatDecimal', () => {
  it("uses the viewer's locale and a fixed number of decimals", () => {
    expect(formatDecimal(72.5, 1, 'en-US')).toBe('72.5')
    expect(formatDecimal(72.5, 1, 'de-DE')).toBe('72,5')
    expect(formatDecimal(72, 2, 'en-US')).toBe('72.00')
  })
})

function errors(values: Partial<AttributeFormValues>) {
  const result = attributeSchema.safeParse({
    ...emptyAttributeForm,
    name: 'Weight',
    ...values,
  })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('metric form', () => {
  it('needs a name of up to 80 characters', () => {
    expect(errors({ name: ' ' })).toEqual({ name: 'Enter a name.' })
    expect(errors({ name: 'x'.repeat(81) })).toEqual({
      name: 'Use at most 80 characters.',
    })
  })

  it('takes a unit of up to 20 characters', () => {
    expect(errors({ unit: 'x'.repeat(21) })).toEqual({
      unit: 'Use at most 20 characters.',
    })
  })

  it('takes optional limits as numbers, minimum not above maximum', () => {
    expect(errors({ minValue: 'lots' })).toEqual({
      minValue: 'Enter a number.',
    })
    expect(errors({ minValue: '100', maxValue: '40' })).toEqual({
      maxValue: "The maximum can't be below the minimum.",
    })
    expect(errors({ minValue: '40', maxValue: '40' })).toEqual({})
    expect(errors({ minValue: '', maxValue: '250,5' })).toEqual({})
  })

  it('saves trimmed text, numbers and no unit as none', () => {
    const values = attributeSchema.parse({
      name: ' Weight ',
      unit: '  ',
      precision: '2',
      direction: 'lower_better',
      minValue: '40',
      maxValue: '250,5',
    })
    expect(toAttributeRow(values)).toEqual({
      name: 'Weight',
      unit: null,
      precision: 2,
      direction: 'lower_better',
      min_value: 40,
      max_value: 250.5,
    })
  })

  it('fills the edit form from a saved metric', () => {
    expect(
      toAttributeForm({
        name: 'Waist',
        unit: 'cm',
        precision: 0,
        direction: 'neutral',
        min_value: null,
        max_value: 150,
      }),
    ).toEqual({
      name: 'Waist',
      unit: 'cm',
      precision: '0',
      direction: 'neutral',
      minValue: '',
      maxValue: '150',
    })
  })
})

describe('metric summaries', () => {
  const weight = {
    name: 'Weight',
    unit: 'kg',
    precision: 1,
    direction: 'lower_better' as const,
    min_value: 40,
    max_value: 250.5,
  }

  it('labels a metric with its unit, if any', () => {
    expect(attributeLabel(weight)).toBe('Weight (kg)')
    expect(attributeLabel({ name: 'Mood', unit: null })).toBe('Mood')
  })

  it('lists decimals, direction and limits', () => {
    expect(attributeDetails(weight, 'en-US')).toBe(
      '1 decimal · Lower is better · 40–250.5',
    )
    expect(attributeDetails(weight, 'de-DE')).toBe(
      '1 decimal · Lower is better · 40–250,5',
    )
    expect(
      attributeDetails(
        { ...weight, precision: 0, direction: 'neutral', max_value: null },
        'en-US',
      ),
    ).toBe('Whole numbers · at least 40')
    expect(
      attributeDetails({ ...weight, precision: 3, min_value: null }, 'en-US'),
    ).toBe('3 decimals · Lower is better · at most 250.5')
  })
})
