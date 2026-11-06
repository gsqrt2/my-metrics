import { useEffect, useState } from 'react'

import { AuthContext, type AuthState } from '@/features/auth/auth-context'
import { supabase } from '@/lib/supabase'

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

  return <AuthContext value={state}>{children}</AuthContext>
}
