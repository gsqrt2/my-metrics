import { QueryClientProvider } from '@tanstack/react-query'

import { ThemeProvider } from '@/app/theme'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider } from '@/features/auth/auth-provider'
import { queryClient } from '@/lib/query-client'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
      {/* Confirms settings that save on their own (no Save button). Bottom
          centre, clear of the floating "Log entry" button on phones. */}
      <Toaster position="bottom-center" />
    </ThemeProvider>
  )
}
