import { Outlet } from 'react-router'

import { Logo } from '@/app/layout/logo'

// Centered layout for the pages people see before logging in.
export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center bg-muted/40 px-4 py-12 sm:justify-center sm:py-16">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Logo className="self-center text-2xl" />
        <Outlet />
      </div>
    </div>
  )
}
