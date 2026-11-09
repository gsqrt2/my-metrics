import { Menu } from 'lucide-react'
import { useState } from 'react'
import { Outlet } from 'react-router'

import { LogEntryButton } from '@/app/layout/log-entry-button'
import { Logo } from '@/app/layout/logo'
import { MainNav } from '@/app/layout/main-nav'
import { UserMenu } from '@/app/layout/user-menu'
import { LogEntryProvider } from '@/features/entries/log-entry-provider'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'

export function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <LogEntryProvider>
      <div className="min-h-svh bg-background md:grid md:grid-cols-[16rem_1fr]">
        {/* Desktop: fixed sidebar */}
        <aside className="sticky top-0 hidden h-svh flex-col gap-6 border-r bg-sidebar p-4 text-sidebar-foreground md:flex">
          <div className="px-2 pt-1">
            <Logo />
          </div>
          <LogEntryButton />
          <div className="flex-1">
            <MainNav />
          </div>
          <UserMenu />
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Phone: top bar with the menu in a sheet */}
          <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu aria-hidden />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 gap-6 p-4">
                <SheetHeader className="p-0 px-2 pt-1">
                  <SheetTitle asChild>
                    <Logo />
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Main menu
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1">
                  <MainNav onNavigate={() => setMenuOpen(false)} />
                </div>
                <UserMenu />
              </SheetContent>
            </Sheet>
            <Logo />
          </header>

          {/* Main slot: each route renders here */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-24 md:px-8 md:py-10">
            <Outlet />
          </main>
        </div>

        {/* Phone: floating primary action */}
        <LogEntryButton
          variant="floating"
          className="fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        />
      </div>
    </LogEntryProvider>
  )
}
