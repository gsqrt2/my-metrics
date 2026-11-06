import { useEffect, useState } from 'react'

import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'

// The session's user is a copy stored at login and only renewed with the
// token. If the account changes elsewhere (e.g. an email change confirmed in
// another browser), get a fresh session so this tab shows the current data.
async function syncUserWithServer() {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) return

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return

  const stored = session.user
  if (
    data.user.email !== stored.email ||
    data.user.new_email !== stored.new_email
  ) {
    await supabase.auth.refreshSession() // fires TOKEN_REFRESHED below
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    status: 'loading',
    session: null,
  })

  useEffect(() => {
    // Fires once with the stored session (INITIAL_SESSION), then on every
    // sign-in, sign-out and token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ status: 'ready', session })
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    syncUserWithServer()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') syncUserWithServer()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () =>
      document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  return <AuthContext value={state}>{children}</AuthContext>
}
