import type { Attribute } from '@/features/attributes/use-attributes'
import type { Subject } from '@/features/subjects/use-subjects'

// FR-70: a logbook's entries as CSV, as the user sees them in the app: the
// value where it's visible, only the % change where its owner hides it
// (FR-43), and a column saying which.

export type ExportRow = {
  subject_id: string
  attribute_id: string
  measured_at: string
  value: number | null
  pct_change: number | null
  comment: string | null
  creator_name: string | null
}

// The byte order mark, so Excel opens the file as UTF-8.
export const BOM = String.fromCharCode(0xfeff)

export const CSV_HEADER = [
  'Participant',
  'Metric',
  'Unit',
  'Measured at',
  'Value',
  'Change since first entry (%)',
  'Contains',
  'Comment',
  'Logged by',
]

const pad = (n: number) => String(n).padStart(2, '0')

// Local time as yyyy-mm-dd hh:mm: spreadsheets read it in any language.
export function csvDateTime(iso: string) {
  const d = new Date(iso)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

// Quotes a cell when needed. Text that a spreadsheet would run as a formula
// (=, +, -, @ first) is prefixed with ' so it stays text.
export function csvCell(value: string, text = true) {
  const safe = text && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(
  rows: ExportRow[],
  subjects: Subject[],
  attributes: Attribute[],
) {
  const lines = [CSV_HEADER.map((h) => csvCell(h)).join(',')]
  for (const row of rows) {
    const subject = subjects.find((s) => s.id === row.subject_id)
    const attribute = attributes.find((a) => a.id === row.attribute_id)
    lines.push(
      [
        csvCell(subject?.name ?? ''),
        csvCell(attribute?.name ?? ''),
        csvCell(attribute?.unit ?? ''),
        csvCell(csvDateTime(row.measured_at), false),
        csvCell(
          row.value === null
            ? ''
            : row.value.toFixed(attribute?.precision ?? 2),
          false,
        ),
        csvCell(row.pct_change === null ? '' : String(row.pct_change), false),
        csvCell(row.value === null ? '% change only' : 'Value', false),
        csvCell(row.comment ?? ''),
        csvCell(row.creator_name ?? ''),
      ].join(','),
    )
  }
  // CRLF line ends and the byte order mark, for Excel.
  return BOM + lines.join('\r\n') + '\r\n'
}

// "Diet Challenge entries 2026-11-10.csv"
export function csvFileName(groupName: string, today = new Date()) {
  const name =
    groupName
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Logbook'
  const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
  return `${name} entries ${day}.csv`
}
