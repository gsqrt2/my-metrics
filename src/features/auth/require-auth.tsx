import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/features/auth/use-auth'

export type LoginLocationState = { from?: string }

// Sends logged-out visitors to the login page and back here afterwards.
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status, session } = useAuth()
  const location = useLocation()

  if (status === 'loading') return null
  if (!session) {
    const state: LoginLocationState = {
      from: location.pathname + location.search,
    }
    return <Navigate to="/login" replace state={state} />
  }
  return children
}
