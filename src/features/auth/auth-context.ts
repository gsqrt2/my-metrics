import type { Session } from '@supabase/supabase-js'
import { createContext } from 'react'

export type AuthState =
  | { status: 'loading'; session: null }
  | { status: 'ready'; session: Session | null }

export const AuthContext = createContext<AuthState | null>(null)
