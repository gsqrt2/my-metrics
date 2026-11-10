import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { fetchAttributes } from '@/features/attributes/use-attributes'
import { csvFileName, toCsv, type ExportRow } from '@/features/export/csv'
import { fetchSubjects } from '@/features/subjects/use-subjects'
import { supabase } from '@/lib/supabase'

// The API returns at most 1000 rows per request.
const PAGE = 1000

async function fetchAllRows(groupId: string) {
  const rows: ExportRow[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.rpc('get_entry_rows', {
      target_group_id: groupId,
      sort: 'oldest',
      page_size: PAGE,
      page_offset: offset,
    })
    if (error) throw error
    rows.push(...(data as ExportRow[]))
    if (data.length < PAGE) return rows
  }
}

function download(text: string, fileName: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// FR-70: downloads the logbook's entries as CSV, oldest first.
export function useExportCsv(group: { id: string; name: string }) {
  return useMutation({
    mutationFn: async () => {
      const [rows, subjects, attributes] = await Promise.all([
        fetchAllRows(group.id),
        fetchSubjects(group.id),
        fetchAttributes(group.id),
      ])
      download(toCsv(rows, subjects, attributes), csvFileName(group.name))
      return rows.length
    },
    onSuccess: (count) =>
      toast.success(
        count === 0
          ? 'Exported. The logbook has no entries yet, so the file has only the column names.'
          : `Exported ${count === 1 ? '1 entry' : `${count} entries`}.`,
      ),
    onError: () =>
      toast.error("The export couldn't be made. Please try again."),
  })
}
