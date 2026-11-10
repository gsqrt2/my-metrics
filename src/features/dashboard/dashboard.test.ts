import { describe, expect, it } from 'vitest'

import {
  attributesWithoutChange,
  dateTickFormat,
  fullScreenMaxPoints,
  metricRows,
  participantRows,
  periodRange,
  xOf,
} from '@/features/dashboard/chart-data'
import {
  durationProgress,
  formatDurationProgress,
} from '@/features/dashboard/progress'
import { isSelected, toggleSelection } from '@/features/dashboard/selection'
import type { SeriesPoint } from '@/features/dashboard/use-dashboard'

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

const point = (
  subject: string,
  attribute: string,
  at: string,
  value: number | null,
  more: Partial<SeriesPoint> = {},
): SeriesPoint => ({
  subject_id: subject,
  attribute_id: attribute,
  measured_at: at,
  value,
  change: value,
  pct_change: value,
  entry_count: 1,
  entry_id: null,
  comment: null,
  ...more,
})
const t = (iso: string) => Date.parse(iso)

describe('metricRows (by metric)', () => {
  const subjects = [
    { id: 'mia', birthdate: '2019-04-12' },
    { id: 'noah', birthdate: null },
  ]
  const points = [
    point('mia', 'w', '2026-10-01T08:00:00Z', 20, { change: 0, pct_change: 0 }),
    point('noah', 'w', '2026-10-01T08:00:00Z', 14),
    point('mia', 'w', '2026-11-01T08:00:00Z', 21, {
      change: 1,
      pct_change: 5,
      comment: 'New scale',
    }),
    point('noah', 'w', '2026-10-15T08:00:00Z', 14.5, { entry_count: 3 }),
    point('mia', 'h', '2026-10-01T08:00:00Z', 120),
    point('kim', 'w', '2026-10-01T08:00:00Z', 70),
  ]

  it('puts subjects measured at the same moment in one row, oldest first', () => {
    const rows = metricRows(points, 'w', subjects)
    expect(rows.map((r) => r.x)).toEqual([
      t('2026-10-01T08:00:00Z'),
      t('2026-10-15T08:00:00Z'),
      t('2026-11-01T08:00:00Z'),
    ])
    expect(rows[0]).toMatchObject({ mia: 20, noah: 14 })
  })

  it('keeps what the tooltip needs: value, count and comment', () => {
    const rows = metricRows(points, 'w', subjects)
    expect(rows[1]).toMatchObject({ noah: 14.5, 'n:noah': 3 })
    expect(rows[2]).toMatchObject({ mia: 21, 'c:mia': 'New scale' })
  })

  it('plots the change or the % change when asked', () => {
    const rows = metricRows(points, 'w', [subjects[0]], 'date', 'pct')
    expect(rows.map((r) => r.mia)).toEqual([0, 5])
    expect(rows[1]['v:mia']).toBe(21)
  })

  it('keeps to the attribute and the chosen subjects, and skips hidden values', () => {
    expect(metricRows(points, 'w', [subjects[1]])).toHaveLength(2)
    expect(
      metricRows(
        [point('mia', 'w', '2026-10-01T08:00:00Z', null)],
        'w',
        subjects,
      ),
    ).toEqual([])
  })

  it('places points by age when asked (FR-63)', () => {
    const [row] = metricRows(points.slice(0, 1), 'w', subjects, 'age')
    expect(row.x).toBeCloseTo(7.47, 2)
  })
})

describe('participantRows (by participant)', () => {
  const mia = { id: 'mia', birthdate: null }
  const points = [
    point('mia', 'w', '2026-10-01T08:00:00Z', 20, { pct_change: 0 }),
    point('mia', 'h', '2026-10-01T08:00:00Z', 120, { pct_change: 0 }),
    point('mia', 'w', '2026-11-01T08:00:00Z', 21, { pct_change: 5 }),
    point('mia', 'g', '2026-10-01T08:00:00Z', 0, { pct_change: null }),
    point('mia', 'g', '2026-11-01T08:00:00Z', 3, { pct_change: null }),
    point('kim', 'w', '2026-10-01T08:00:00Z', 70, { pct_change: 0 }),
  ]

  it("has each attribute's % change and, for the tooltip, its value", () => {
    const rows = participantRows(points, mia, ['w', 'h'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ w: 0, 'v:w': 20, h: 0, 'v:h': 120 })
    expect(rows[1]).toMatchObject({ w: 5, 'v:w': 21 })
  })

  it('leaves out attributes without a % change (first value 0)', () => {
    expect(participantRows(points, mia, ['g'])).toEqual([])
    expect(
      attributesWithoutChange(points, 'mia', ['w', 'h', 'g', 'x']),
    ).toEqual(['g'])
  })
})

describe('xOf', () => {
  it('is the time, or the age in years when a birthdate is known', () => {
    expect(xOf('2026-10-01T00:00:00Z', 'date', '2020-10-01')).toBe(
      t('2026-10-01T00:00:00Z'),
    )
    expect(xOf('2026-10-01T00:00:00Z', 'age', null)).toBe(
      t('2026-10-01T00:00:00Z'),
    )
    expect(xOf('2026-10-01T12:00:00', 'age', '2020-10-01')).toBeCloseTo(6, 1)
  })
})

describe('dateTickFormat', () => {
  it('shows day then month within a year, month and year beyond', () => {
    const short = dateTickFormat([
      { x: t('2026-10-05T12:00:00Z') },
      { x: t('2026-11-09T12:00:00Z') },
    ])
    expect(short(t('2026-10-05T12:00:00Z'))).toBe('5 Oct')
    const long = dateTickFormat([
      { x: t('2025-11-01T12:00:00Z') },
      { x: t('2026-11-01T12:00:00Z') },
    ])
    expect(long(t('2025-11-01T12:00:00Z'))).toBe('Nov 2025')
  })
})

describe('periodRange (FR-64)', () => {
  const now = new Date(2026, 10, 9, 15, 30)

  it('counts back from today, from the start of that day', () => {
    expect(periodRange('week', now)).toEqual({
      from: new Date(2026, 10, 3),
    })
    expect(periodRange('month', now)).toEqual({
      from: new Date(2026, 9, 9),
    })
    expect(periodRange('year', now)).toEqual({
      from: new Date(2025, 10, 9),
    })
    expect(periodRange('all', now)).toEqual({})
  })
})

describe('fullScreenMaxPoints', () => {
  it('scales with the width, between 100 and 500', () => {
    expect(fullScreenMaxPoints(300)).toBe(100)
    expect(fullScreenMaxPoints(900)).toBe(300)
    expect(fullScreenMaxPoints(2400)).toBe(500)
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
