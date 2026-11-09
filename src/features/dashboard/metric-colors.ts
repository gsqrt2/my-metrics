import { SUBJECT_COLORS, type SubjectColor } from '@/features/subjects/colors'

// In the "by participant" chart each line is an attribute, so attributes take
// the categorical palette in their sort order. Colours are never repeated
// within a chart, so it shows at most this many attributes at once.
export const MAX_METRICS_PER_CHART = SUBJECT_COLORS.length

export function metricColors(attributeIds: string[]) {
  return new Map<string, SubjectColor>(
    attributeIds
      .slice(0, MAX_METRICS_PER_CHART)
      .map((id, index) => [id, SUBJECT_COLORS[index].value]),
  )
}
