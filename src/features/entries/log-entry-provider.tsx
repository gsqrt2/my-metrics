import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { LogEntryContext } from '@/features/entries/log-entry-context'
import { LogEntryForm } from '@/features/entries/log-entry-form'
import {
  useLoggableGroups,
  type BlockedGroup,
} from '@/features/entries/use-loggable-groups'
import { useGroups } from '@/features/groups/use-groups'
import { TrackMyselfButton } from '@/features/subjects/track-myself'

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
  // For naming the logbook the form was opened from, if it can't be used.
  const allGroups = useGroups()

  const openLogEntry = useCallback(
    (groupId?: string) => {
      // Always start from fresh data: a metric or participant may have been
      // added since the form was last open.
      queryClient.removeQueries({ queryKey: ['loggable-groups'] })
      setState((s) => ({ open: true, presetGroupId: groupId, key: s.key + 1 }))
    },
    [queryClient],
  )
  const presetGroup = allGroups.data?.find((g) => g.id === state.presetGroupId)
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
            {groups.data &&
              (() => {
                const { groups: loggable, blocked } = groups.data
                const preset = state.presetGroupId
                const presetLoggable =
                  preset !== undefined && loggable.some((g) => g.id === preset)
                if (preset !== undefined && blocked[preset]) {
                  return (
                    <BlockedGroupHelp
                      groupId={preset}
                      groupName={presetGroup?.name ?? 'This logbook'}
                      blocked={blocked[preset]}
                      onNavigate={(to) => {
                        close()
                        navigate(to)
                      }}
                    />
                  )
                }
                if (loggable.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground">
                      There's nowhere to log yet. A logbook needs at least one
                      metric and a participant you may log for: open one of your
                      logbooks and choose what to measure.
                    </p>
                  )
                }
                return (
                  <LogEntryForm
                    key={state.key}
                    groups={loggable}
                    presetGroupId={presetLoggable ? preset : undefined}
                    lockGroup={presetLoggable}
                    onCancel={close}
                    onSaved={(groupId) => {
                      close()
                      navigate(`/logbooks/${groupId}`)
                    }}
                  />
                )
              })()}
          </div>
        </SheetContent>
      </Sheet>
    </LogEntryContext.Provider>
  )
}

// Opened from a logbook that can't be logged in: why, and the way out,
// rather than switching to another logbook.
function BlockedGroupHelp({
  groupId,
  groupName,
  blocked,
  onNavigate,
}: {
  groupId: string
  groupName: string
  blocked: BlockedGroup
  onNavigate: (to: string) => void
}) {
  const path = `/logbooks/${groupId}`
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p>
        <span className="text-muted-foreground">Logbook: </span>
        <span className="font-medium">{groupName}</span>
      </p>
      {blocked.reason === 'archived' && (
        <p>This logbook is archived, so nothing can be logged in it.</p>
      )}
      {blocked.reason === 'no_metrics' && (
        <>
          <p>It has no metrics yet, so there's nothing to log.</p>
          {blocked.canManage ? (
            <Button
              className="self-start"
              onClick={() => onNavigate(`${path}/metrics`)}
            >
              Choose what to measure
            </Button>
          ) : (
            <p className="text-muted-foreground">
              The owner or an editor adds them.
            </p>
          )}
        </>
      )}
      {blocked.reason === 'no_participants' && (
        <>
          <p>There's no participant here that you may log for.</p>
          <div className="flex flex-wrap gap-2">
            {blocked.canTrackMyself && (
              <TrackMyselfButton groupId={groupId} groupName={groupName} />
            )}
            {blocked.canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate(`${path}/participants/new`)}
              >
                Add participant
              </Button>
            )}
          </div>
          {!blocked.canTrackMyself && !blocked.canManage && (
            <p className="text-muted-foreground">
              Ask the owner to let you log here.
            </p>
          )}
        </>
      )}
    </div>
  )
}
