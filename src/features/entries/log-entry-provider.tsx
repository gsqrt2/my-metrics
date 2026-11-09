import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { LogEntryContext } from '@/features/entries/log-entry-context'
import { LogEntryForm } from '@/features/entries/log-entry-form'
import { useLoggableGroups } from '@/features/entries/use-loggable-groups'

// Hosts the "Log entry" sheet for the whole app: full screen on phones, a
// side sheet on larger screens. Any page opens it through useLogEntry().
export function LogEntryProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [state, setState] = useState<{
    open: boolean
    presetGroupId?: string
    // A fresh form each time the sheet opens.
    key: number
  }>({ open: false, key: 0 })
  const groups = useLoggableGroups(state.open)

  const openLogEntry = useCallback(
    (groupId?: string) => {
      // Always start from fresh data: a metric or participant may have been
      // added since the form was last open.
      queryClient.removeQueries({ queryKey: ['loggable-groups'] })
      setState((s) => ({ open: true, presetGroupId: groupId, key: s.key + 1 }))
    },
    [queryClient],
  )
  const close = () => setState((s) => ({ ...s, open: false }))
  const value = useMemo(() => ({ openLogEntry }), [openLogEntry])

  return (
    <LogEntryContext.Provider value={value}>
      {children}
      <Sheet open={state.open} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="right"
          className="overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <SheetHeader className="pb-0">
            <SheetTitle>Log entry</SheetTitle>
            <SheetDescription>
              Record what you measured, now or earlier.
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">
            {groups.isPending && (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
            {groups.isError && (
              <Alert variant="destructive">
                <AlertDescription>
                  Your logbooks couldn't be loaded. Please try again.
                </AlertDescription>
              </Alert>
            )}
            {groups.data && groups.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                There's nowhere to log yet. A logbook needs at least one metric
                and a participant you may log for: open one of your logbooks and
                choose what to measure.
              </p>
            )}
            {groups.data && groups.data.length > 0 && (
              <LogEntryForm
                key={state.key}
                groups={groups.data}
                presetGroupId={state.presetGroupId}
                onCancel={close}
                onSaved={(groupId) => {
                  close()
                  navigate(`/logbooks/${groupId}`)
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </LogEntryContext.Provider>
  )
}
