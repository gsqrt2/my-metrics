import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/features/auth/use-auth'
import { supabase } from '@/lib/supabase'

// The signed-in user's own profile.
export function useProfile() {
  const { session } = useAuth()
  const userId = session?.user.id

  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return data
    },
  })
}
