import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/theme'
import { routes } from '@/app/routes'
import type { AuthState } from '@/features/auth/auth-context'

const auth = vi.hoisted(() => ({ state: null as AuthState | null }))

vi.mock('@/features/auth/use-auth', () => ({ useAuth: () => auth.state }))
vi.mock('@/features/profile/use-profile', () => ({
  useProfile: () => ({ data: { id: 'u1', display_name: 'Alex Example' } }),
}))

const loggedIn = {
  status: 'ready',
  session: { user: { id: 'u1', email: 'alex@example.com' } },
} as AuthState

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ThemeProvider>
      <QueryClientProvider client={new QueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ThemeProvider>,
  )
  return router
}

describe('when logged in', () => {
  beforeEach(() => {
    auth.state = loggedIn
  })

  it('redirects the start page to the group list', async () => {
    const router = renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Groups' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups')
  })

  it('shows the logo, main menu, primary action and the user', async () => {
    renderAt('/groups')
    await screen.findByRole('heading', { name: 'Groups' })

    expect(screen.getAllByLabelText('my-metrics home').length).toBeGreaterThan(
      0,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toHaveTextContent('Groups')
    expect(nav).toHaveTextContent('Profile')
    // One in the desktop sidebar, one floating on phones; CSS decides which shows.
    expect(screen.getAllByRole('button', { name: 'Log entry' })).toHaveLength(2)
    expect(screen.getAllByText('Alex Example').length).toBeGreaterThan(0)
    expect(screen.getAllByText('alex@example.com').length).toBeGreaterThan(0)
  })

  it('marks the current page in the menu', async () => {
    renderAt('/profile')
    await screen.findByRole('heading', { name: 'Profile' })

    const nav = screen.getByRole('navigation', { name: 'Main' })
    const active = nav.querySelector('[aria-current="page"]')
    expect(active).toHaveTextContent('Profile')
  })

  it('shows a not-found page for unknown routes', async () => {
    renderAt('/nope')
    expect(
      await screen.findByRole('heading', { name: 'Page not found' }),
    ).toBeInTheDocument()
  })

  it('sends the login page on to the group list', async () => {
    const router = renderAt('/login')
    await screen.findByRole('heading', { name: 'Groups' })
    expect(router.state.location.pathname).toBe('/groups')
  })
})

describe('when logged out', () => {
  beforeEach(() => {
    auth.state = { status: 'ready', session: null }
  })

  it('sends app pages to the login page and remembers where to return', async () => {
    const router = renderAt('/profile')
    expect(
      await screen.findByRole('heading', { name: 'Log in' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(router.state.location.state).toEqual({ from: '/profile' })
  })

  it('offers no sign-up, only a password reset', async () => {
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Log in' })
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Forgot password?' }),
    ).toHaveAttribute('href', '/forgot-password')
  })
})

describe('while the session is loading', () => {
  it('renders nothing instead of flashing the login page', () => {
    auth.state = { status: 'loading', session: null }
    renderAt('/groups')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
