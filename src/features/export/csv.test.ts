import { describe, expect, it } from 'vitest'

import type { Attribute } from '@/features/attributes/use-attributes'
import {
  BOM,
  csvCell,
  csvFileName,
  toCsv,
  type ExportRow,
} from '@/features/export/csv'
import type { Subject } from '@/features/subjects/use-subjects'

const subjects = [
  { id: 's1', name: 'Alex' },
  { id: 's2', name: 'Kim, "K"' },
] as Subject[]
const attributes = [
  { id: 'a1', name: 'Weight', unit: 'kg', precision: 1 },
  { id: 'a2', name: 'Mood', unit: null, precision: 0 },
] as Attribute[]

const row = (over: Partial<ExportRow>): ExportRow => ({
  subject_id: 's1',
  attribute_id: 'a1',
  measured_at: new Date(2026, 10, 9, 7, 5).toISOString(),
  value: 72,
  pct_change: 0,
  comment: null,
  creator_name: 'Alex',
  ...over,
})

describe('toCsv (FR-70)', () => {
  it('writes a header and a line per entry, with the value or only its % change', () => {
    const text = toCsv(
      [
        row({}),
        row({
          subject_id: 's2',
          attribute_id: 'a2',
          value: null,
          pct_change: -2.5,
          comment: 'after a run\nfelt good',
        }),
      ],
      subjects,
      attributes,
    )
    expect(text.startsWith(BOM)).toBe(true)
    expect(text.slice(1).split('\r\n')).toEqual([
      'Participant,Metric,Unit,Measured at,Value,Change since first entry (%),Contains,Comment,Logged by',
      'Alex,Weight,kg,2026-11-09 07:05,72.0,0,Value,,Alex',
      '"Kim, ""K""",Mood,,2026-11-09 07:05,,-2.5,% change only,"after a run\nfelt good",Alex',
      '',
    ])
  })
})

describe('csvCell', () => {
  it('keeps text that looks like a formula as text', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(csvCell('-3', false)).toBe('-3')
  })
})

describe('csvFileName', () => {
  it('names the file after the logbook and the day', () => {
    expect(csvFileName('Kids / 2026', new Date(2026, 10, 10))).toBe(
      'Kids 2026 entries 2026-11-10.csv',
    )
  })
})
