import { render, screen } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { describe, expect, it } from 'vitest'

import { Providers } from '@/app/providers'
import { routes } from '@/app/routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

describe('AppLayout', () => {
  it('redirects the start page to the group list', async () => {
    const router = renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Groups' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/groups')
  })

  it('shows the logo, main menu and primary action', async () => {
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
})
