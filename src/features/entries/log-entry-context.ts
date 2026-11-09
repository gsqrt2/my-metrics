import { createContext, useContext } from 'react'

export type LogEntryContextValue = {
  // Opens the "Log entry" form, starting in the given logbook if any.
  openLogEntry: (groupId?: string) => void
}

export const LogEntryContext = createContext<LogEntryContextValue | null>(null)

export function useLogEntry() {
  const context = useContext(LogEntryContext)
  if (!context) throw new Error('useLogEntry needs a LogEntryProvider')
  return context
}
