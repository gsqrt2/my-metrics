import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/theme'
import { routes } from '@/app/routes'
import type { AuthState } from '@/features/auth/auth-context'
import type { GroupRow } from '@/features/groups/types'
import type { Subject } from '@/features/subjects/use-subjects'

const auth = vi.hoisted(() => ({ state: null as AuthState | null }))
const data = vi.hoisted(() => ({
  groups: [] as GroupRow[],
  subjects: [] as Subject[],
}))

vi.mock('@/features/auth/use-auth', () => ({ useAuth: () => auth.state }))
vi.mock('@/features/profile/use-profile', () => ({
  useProfile: () => ({ data: { id: 'u1', display_name: 'Alex Example' } }),
}))
vi.mock('@/features/groups/use-groups', async (importOriginal) => ({
  ...(await importOriginal()),
  useGroups: () => ({ data: data.groups }),
  useGroup: (id: string) => ({
    data: data.groups.find((group) => group.id === id) ?? null,
  }),
}))

vi.mock('@/features/subjects/use-subjects', async (importOriginal) => ({
  ...(await importOriginal()),
  useSubjects: (groupId: string) => ({
    data: data.subjects.filter((subject) => subject.group_id === groupId),
  }),
}))

const personal: GroupRow = {
  id: 'g-personal',
  name: 'Personal',
  description: null,
  starts_on: null,
  ends_on: null,
  isDefault: true,
  role: 'owner',
  memberCount: 1,
}
const diet: GroupRow = {
  id: 'g-diet',
  name: 'Diet Challenge',
  description: 'Twelve weeks.',
  starts_on: '2026-10-05',
  ends_on: '2026-12-27',
  isDefault: false,
  role: 'viewer',
  memberCount: 3,
}

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
    data.groups = [personal, diet]
    data.subjects = [
      {
        id: 's-me',
        group_id: 'g-personal',
        name: 'Alex Example',
        birthdate: null,
        color: 'blue',
        linked_user_id: 'u1',
        name_customized: false,
        archived_at: null,
      },
      {
        id: 's-kim',
        group_id: 'g-diet',
        name: 'Kim',
        birthdate: null,
        color: 'orange',
        linked_user_id: 'u2',
        name_customized: false,
        archived_at: null,
      },
      {
        id: 's-old',
        group_id: 'g-personal',
        name: 'Old Friend',
        birthdate: null,
        color: 'aqua',
        linked_user_id: null,
        name_customized: false,
        archived_at: '2026-10-01T00:00:00Z',
      },
    ]
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

  it('lists the groups with their links', async () => {
    renderAt('/groups')
    const list = await screen.findByRole('list', { name: 'Your groups' })
    expect(list.querySelectorAll('li')).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /Diet Challenge/ }),
    ).toHaveAttribute('href', '/groups/g-diet')
    expect(screen.getByRole('link', { name: 'New group' })).toHaveAttribute(
      'href',
      '/groups/new',
    )
  })

  it('offers editing to owners and editors only', async () => {
    renderAt('/groups/g-personal')
    expect(
      await screen.findByRole('link', { name: 'Edit group' }),
    ).toHaveAttribute('href', '/groups/g-personal/edit')
  })

  it('links from a group back to the group list', async () => {
    renderAt('/groups/g-diet')
    await screen.findByRole('heading', { name: 'Diet Challenge' })
    const main = screen.getByRole('main')
    expect(within(main).getByRole('link', { name: 'Groups' })).toHaveAttribute(
      'href',
      '/groups',
    )
  })

  it("shows a group's active subjects compactly, marking the user's own", async () => {
    renderAt('/groups/g-personal')
    const list = await screen.findByRole('list', { name: 'Subjects' })
    expect(list).toHaveTextContent('Alex Example(you)')
    expect(list).not.toHaveTextContent('Old Friend')
    expect(
      screen.getByRole('link', { name: 'Manage subjects' }),
    ).toHaveAttribute('href', '/groups/g-personal/subjects')
  })

  it('lets owners and editors manage subjects on their own page', async () => {
    renderAt('/groups/g-personal/subjects')
    const list = await screen.findByRole('list', { name: 'Subjects' })
    expect(within(list).getByText('You')).toBeInTheDocument()
    expect(
      within(list).getByRole('link', { name: 'Edit Alex Example' }),
    ).toHaveAttribute('href', '/groups/g-personal/subjects/s-me/edit')
    expect(screen.getByRole('link', { name: 'Add subject' })).toHaveAttribute(
      'href',
      '/groups/g-personal/subjects/new',
    )

    expect(screen.queryByText('Old Friend')).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Show archived subjects (1)' }).click()
    expect(
      await screen.findByRole('list', { name: 'Archived subjects' }),
    ).toHaveTextContent('Old Friend')
  })

  it('shows viewers the subjects but not their management', async () => {
    renderAt('/groups/g-diet')
    const list = await screen.findByRole('list', { name: 'Subjects' })
    expect(list).toHaveTextContent('Kim')
    expect(
      screen.queryByRole('link', { name: 'Manage subjects' }),
    ).not.toBeInTheDocument()
  })

  it('keeps viewers out of subject management', async () => {
    renderAt('/groups/g-diet/subjects')
    expect(
      await screen.findByText(
        "Only the group's owner and editors can manage subjects.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Add subject' }),
    ).not.toBeInTheDocument()
  })

  it('shows viewers the group without editing', async () => {
    renderAt('/groups/g-diet')
    await screen.findByRole('heading', { name: 'Diet Challenge' })
    expect(screen.getByText('Viewer')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Edit group' }),
    ).not.toBeInTheDocument()
  })

  it('does not show viewers the edit form', async () => {
    renderAt('/groups/g-diet/edit')
    await screen.findByText("Only the group's owner and editors can change it.")
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('shows a not-found page for groups the user is not in', async () => {
    renderAt('/groups/someone-elses')
    expect(
      await screen.findByRole('heading', { name: 'Group not found' }),
    ).toBeInTheDocument()
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
