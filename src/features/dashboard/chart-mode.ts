import { useState } from 'react'

// The group page's two chart views (decided 2026-11-09):
// - by metric: a chart per attribute with every subject, in real values
// - by participant: a chart per subject with every attribute, as % change
export type ChartMode = 'metric' | 'participant'

const key = (groupId: string) => `my-metrics:chart-mode:${groupId}`

// Remembered per group on this device; "by metric" until chosen otherwise.
// A convenience: if storage is blocked, it just isn't remembered.
export function useChartMode(groupId: string) {
  const [mode, setMode] = useState<ChartMode>(() => {
    try {
      return localStorage.getItem(key(groupId)) === 'participant'
        ? 'participant'
        : 'metric'
    } catch {
      return 'metric'
    }
  })
  const choose = (next: ChartMode) => {
    setMode(next)
    try {
      localStorage.setItem(key(groupId), next)
    } catch {
      // Storage blocked: not remembered.
    }
  }
  return [mode, choose] as const
}
