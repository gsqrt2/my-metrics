import { Badge } from '@/components/ui/badge'
import { formatPercent } from '@/features/dashboard/chart-format'
import { formatValue } from '@/features/entries/format'

// An entry's value, or for a value its owner keeps private (FR-43) its %
// change since the first entry, marked "% only"; "n/a" when the first value
// was 0.
export function EntryValue({
  value,
  pctChange,
  attribute,
}: {
  value: number | null
  pctChange: number | null
  attribute: { precision: number; unit: string | null }
}) {
  if (value !== null) {
    return (
      <span className="font-medium tabular-nums">
        {formatValue(value, attribute)}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-medium tabular-nums">
        {pctChange === null ? 'n/a' : formatPercent(pctChange)}
      </span>
      <Badge
        variant="outline"
        title="Only the change since the first entry is shared"
      >
        % only
      </Badge>
    </span>
  )
}
