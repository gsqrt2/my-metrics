import { describe, expect, it } from 'vitest'

import {
  attributesWithoutChange,
  changeRows,
  chartRows,
  dateTickFormat,
} from '@/features/dashboard/chart-data'
import { isSelected, toggleSelection } from '@/features/dashboard/selection'
import {
  durationProgress,
  formatDurationProgress,
} from '@/features/dashboard/progress'

describe('durationProgress (FR-15)', () => {
  const on = (date: string) => new Date(`${date}T12:00:00`)

  it('counts both the first and the last day', () => {
    expect(
      durationProgress('2026-10-05', '2026-12-27', on('2026-10-05')),
    ).toEqual({ state: 'running', day: 1, total: 84, left: 83 })
    expect(
      durationProgress('2026-10-05', '2026-12-27', on('2026-12-27')),
    ).toEqual({ state: 'running', day: 84, total: 84, left: 0 })
  })

  it('knows when it has not started or has ended', () => {
    expect(
      durationProgress('2026-10-05', '2026-12-27', on('2026-10-01')),
    ).toEqual({ state: 'upcoming', startsIn: 4 })
    expect(
      durationProgress('2026-10-05', '2026-12-27', on('2026-12-28')),
    ).toEqual({ state: 'ended' })
  })

  it('reads well', () => {
    expect(
      formatDurationProgress({
        state: 'running',
        day: 36,
        total: 84,
        left: 48,
      }),
    ).toBe('Day 36 of 84 · 48 days left')
    expect(
      formatDurationProgress({ state: 'running', day: 84, total: 84, left: 0 }),
    ).toBe('Day 84 of 84 · last day')
    expect(formatDurationProgress({ state: 'upcoming', startsIn: 1 })).toBe(
      'Starts tomorrow',
    )
    expect(formatDurationProgress({ state: 'upcoming', startsIn: 5 })).toBe(
      'Starts in 5 days',
    )
    expect(formatDurationProgress({ state: 'ended' })).toBe('Ended')
  })
})

describe('chartRows', () => {
  const point = (
    subject: string,
    at: string,
    value: number | null,
    attribute = 'w',
  ) => ({
    subject_id: subject,
    attribute_id: attribute,
    measured_at: at,
    value: value as number,
  })
  const points = [
    point('mia', '2026-10-01T08:00:00Z', 20),
    point('noah', '2026-10-01T08:00:00Z', 14),
    point('mia', '2026-11-01T08:00:00Z', 21),
    point('noah', '2026-10-15T08:00:00Z', 14.5),
    point('mia', '2026-10-01T08:00:00Z', 120, 'h'),
    point('kim', '2026-10-01T08:00:00Z', 70),
  ]

  it('puts subjects measured at the same moment in one row, oldest first', () => {
    expect(chartRows(points, 'w', ['mia', 'noah'])).toEqual([
      { t: Date.parse('2026-10-01T08:00:00Z'), mia: 20, noah: 14 },
      { t: Date.parse('2026-10-15T08:00:00Z'), noah: 14.5 },
      { t: Date.parse('2026-11-01T08:00:00Z'), mia: 21 },
    ])
  })

  it('keeps to the attribute and the chosen subjects, and skips hidden values', () => {
    expect(chartRows(points, 'w', ['noah'])).toHaveLength(2)
    expect(
      chartRows([point('mia', '2026-10-01T08:00:00Z', null)], 'w', ['mia']),
    ).toEqual([])
  })
})

describe('dateTickFormat', () => {
  it('shows day and month within a year, month and year beyond', () => {
    const short = dateTickFormat(
      [
        { t: Date.parse('2026-10-05T12:00:00Z') },
        { t: Date.parse('2026-11-09T12:00:00Z') },
      ],
      'en-US',
    )
    expect(short(Date.parse('2026-10-05T12:00:00Z'))).toBe('Oct 5')
    const long = dateTickFormat(
      [
        { t: Date.parse('2025-11-01T12:00:00Z') },
        { t: Date.parse('2026-11-01T12:00:00Z') },
      ],
      'en-US',
    )
    expect(long(Date.parse('2025-11-01T12:00:00Z'))).toBe('Nov 2025')
  })
})

describe('toggleSelection (chip filters)', () => {
  it('focuses on the first chip tapped, then adds and removes', () => {
    let selected = toggleSelection(null, 'mia', 3)
    expect(selected).toEqual(new Set(['mia']))
    selected = toggleSelection(selected, 'noah', 3)
    expect(selected).toEqual(new Set(['mia', 'noah']))
    selected = toggleSelection(selected, 'mia', 3)
    expect(selected).toEqual(new Set(['noah']))
    expect(toggleSelection(selected, 'noah', 3)).toEqual(new Set())
  })

  it('goes back to "all" once every chip is on', () => {
    expect(toggleSelection(new Set(['mia', 'noah']), 'leo', 3)).toBeNull()
    expect(isSelected(null, 'anyone')).toBe(true)
  })
})

describe('changeRows (by participant)', () => {
  const point = (
    attribute: string,
    at: string,
    value: number,
    pct: number | null,
  ) => ({
    subject_id: 'mia',
    attribute_id: attribute,
    measured_at: at,
    value,
    pct_change: pct,
  })
  const points = [
    point('w', '2026-10-01T08:00:00Z', 20, 0),
    point('h', '2026-10-01T08:00:00Z', 120, 0),
    point('w', '2026-11-01T08:00:00Z', 21, 5),
    point('g', '2026-10-01T08:00:00Z', 0, null),
    point('g', '2026-11-01T08:00:00Z', 3, null),
    { ...point('w', '2026-10-01T08:00:00Z', 70, 0), subject_id: 'kim' },
  ]

  it("has each attribute's % change and, for the tooltip, its value", () => {
    expect(changeRows(points, 'mia', ['w', 'h'])).toEqual([
      {
        t: Date.parse('2026-10-01T08:00:00Z'),
        w: 0,
        'v:w': 20,
        h: 0,
        'v:h': 120,
      },
      { t: Date.parse('2026-11-01T08:00:00Z'), w: 5, 'v:w': 21 },
    ])
  })

  it('leaves out attributes without a % change (first value 0)', () => {
    expect(changeRows(points, 'mia', ['g'])).toEqual([])
    expect(
      attributesWithoutChange(points, 'mia', ['w', 'h', 'g', 'x']),
    ).toEqual(['g'])
  })
})
