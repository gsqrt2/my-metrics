// The logbook and participant last logged for, remembered per device so the
// "Log entry" form can start there next time. A convenience only: if storage is
// blocked or empty, the form falls back to its other defaults.

type LastUsed = {
  groupId?: string
  subjectByGroup: Record<string, string>
}

const key = (userId: string) => `my-metrics:last-logged:${userId}`

export function readLastUsed(userId: string): LastUsed {
  try {
    const raw = localStorage.getItem(key(userId))
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LastUsed>
      return {
        groupId:
          typeof parsed.groupId === 'string' ? parsed.groupId : undefined,
        subjectByGroup:
          parsed.subjectByGroup && typeof parsed.subjectByGroup === 'object'
            ? parsed.subjectByGroup
            : {},
      }
    }
  } catch {
    // Unreadable or blocked storage: no memory.
  }
  return { subjectByGroup: {} }
}

export function rememberLastUsed(
  userId: string,
  groupId: string,
  subjectId: string,
) {
  try {
    const last = readLastUsed(userId)
    localStorage.setItem(
      key(userId),
      JSON.stringify({
        groupId,
        subjectByGroup: { ...last.subjectByGroup, [groupId]: subjectId },
      }),
    )
  } catch {
    // Storage blocked: nothing to remember.
  }
}
