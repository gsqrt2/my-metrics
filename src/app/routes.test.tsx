import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { ThemeProvider } from '@/app/theme'
import { routes } from '@/app/routes'
import type { AuthState } from '@/features/auth/auth-context'
import type { Attribute } from '@/features/attributes/use-attributes'
import type { GroupRow } from '@/features/groups/types'
import type { Subject } from '@/features/subjects/use-subjects'

const auth = vi.hoisted(() => ({ state: null as AuthState | null }))
const data = vi.hoisted(() => ({
  groups: [] as GroupRow[],
  subjects: [] as Subject[],
  attributes: [] as Attribute[],
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

vi.mock('@/features/attributes/use-attributes', async (importOriginal) => ({
  ...(await importOriginal()),
  useAttributes: (groupId: string) => ({
    data: data.attributes.filter((a) => a.group_id === groupId),
  }),
}))

vi.mock('@/features/dashboard/use-dashboard', () => ({
  useSeries: () => ({ data: [] }),
  useDashboard: () => ({ data: [] }),
}))
vi.mock('@/features/entries/use-entry-rows', () => ({
  useEntryRows: () => ({
    data: { entries: [], total: 0 },
    isPending: false,
    isError: false,
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
  membersEditOwnSubjectOnly: false,
  isArchived: false,
  archivedAt: null,
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
  membersEditOwnSubjectOnly: false,
  isArchived: false,
  archivedAt: null,
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
  // The charts are loaded on demand (React.lazy); loading them once up front
  // keeps the tests from waiting on the first import.
  beforeAll(async () => {
    await import('@/features/dashboard/charts-section')
  })

  beforeEach(() => {
    auth.state = loggedIn
    localStorage.clear() // e.g. the remembered chart view
    data.groups = [personal, diet]
    data.attributes = [
      {
        id: 'a-weight',
        group_id: 'g-diet',
        name: 'Weight',
        unit: 'kg',
        precision: 1,
        min_value: null,
        max_value: null,
        sort_order: 0,
        archived_at: null,
      },
    ]
    data.subjects = [
      {
        id: 's-me',
        group_id: 'g-personal',
        name: 'Alex Example',
        birthdate: null,
        color: 'blue',
        linked_user_id: 'u1',
        name_customized: false,
        visibility_frozen: false,
        archived_at: null,
      },
      {
        id: 's-lee',
        group_id: 'g-diet',
        name: 'Lee',
        birthdate: null,
        color: 'aqua',
        linked_user_id: 'u3',
        name_customized: false,
        visibility_frozen: false,
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
        visibility_frozen: false,
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
        visibility_frozen: false,
        archived_at: '2026-10-01T00:00:00Z',
      },
    ]
  })

  it('redirects the start page to the group list', async () => {
    const router = renderAt('/')
    expect(
      await screen.findByRole('heading', { name: 'Logbooks' }),
    ).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/logbooks')
  })

  it('shows the logo, main menu, primary action and the user', async () => {
    renderAt('/logbooks')
    await screen.findByRole('heading', { name: 'Logbooks' })

    expect(screen.getAllByLabelText('my-metrics home').length).toBeGreaterThan(
      0,
    )
    const nav = screen.getByRole('navigation', { name: 'Main' })
    expect(nav).toHaveTextContent('Logbooks')
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
    renderAt('/logbooks')
    const list = await screen.findByRole('list', { name: 'Your logbooks' })
    expect(list.querySelectorAll('li')).toHaveLength(2)
    expect(
      screen.getByRole('link', { name: /Diet Challenge/ }),
    ).toHaveAttribute('href', '/logbooks/g-diet')
    expect(screen.getByRole('link', { name: 'New logbook' })).toHaveAttribute(
      'href',
      '/logbooks/new',
    )
  })

  it('offers owners and editors the logbook options in one menu', async () => {
    renderAt('/logbooks/g-personal')
    await userEvent.click(
      await screen.findByRole('button', { name: 'Options' }),
    )
    const menu = await screen.findByRole('menu')
    expect(
      within(menu).getByRole('menuitem', { name: 'Participants' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/participants')
    expect(
      within(menu).getByRole('menuitem', { name: 'Metrics' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/metrics')
    expect(
      within(menu).getByRole('menuitem', { name: 'Edit logbook' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/edit')
  })

  it('switches between charts by metric and by participant', async () => {
    renderAt('/logbooks/g-diet')
    expect(
      await screen.findByRole('article', { name: 'Weight (kg)' }),
    ).toBeInTheDocument()
    const byParticipant = screen.getByRole('button', { name: 'By participant' })
    expect(byParticipant).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(byParticipant)
    expect(byParticipant).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('article', { name: 'Kim' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Lee' })).toBeInTheDocument()
    // Now the metric chips filter, and the participant chips are plain.
    expect(
      within(screen.getByRole('list', { name: 'Metrics' })).getByRole(
        'button',
        {
          name: /Weight/,
        },
      ),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(screen.getByRole('list', { name: 'Participants' })).queryByRole(
        'button',
      ),
    ).toBeNull()
  })

  it('lets the participants filter the charts by metric', async () => {
    renderAt('/logbooks/g-diet')
    const kim = await screen.findByRole('button', { name: /Kim/ })
    expect(kim).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(kim)
    expect(kim).toHaveAttribute('aria-pressed', 'true')
    const lee = screen.getByRole('button', { name: /Lee/ })
    expect(lee).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(kim)
    expect(
      screen.getByText(
        'Choose at least one participant above to see their charts.',
      ),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(kim).toHaveAttribute('aria-pressed', 'true')
    expect(lee).toHaveAttribute('aria-pressed', 'true')
  })

  it('has no view switch with a single participant', async () => {
    renderAt('/logbooks/g-personal')
    await screen.findByRole('heading', { name: 'Charts' })
    expect(screen.queryByRole('button', { name: 'By participant' })).toBeNull()
  })

  it("shows a logbook's metrics, and invites editors to add the first", async () => {
    renderAt('/logbooks/g-diet')
    expect(
      await screen.findByRole('list', { name: 'Metrics' }),
    ).toHaveTextContent('Weight (kg)')
  })

  it('leads owners and editors from an empty logbook to its metrics', async () => {
    renderAt('/logbooks/g-personal')
    expect(
      await screen.findByRole('link', { name: 'Choose what to measure' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/metrics')
  })

  it('suggests metrics while a logbook has none', async () => {
    renderAt('/logbooks/g-personal/metrics')
    expect(
      await screen.findByRole('heading', { name: 'No metrics yet' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Weight (kg)' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Custom metric…' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/metrics/new')
  })

  it('links from a group back to the group list', async () => {
    renderAt('/logbooks/g-diet')
    await screen.findByRole('heading', { name: 'Diet Challenge' })
    const main = screen.getByRole('main')
    expect(
      within(main).getByRole('link', { name: 'Logbooks' }),
    ).toHaveAttribute('href', '/logbooks')
  })

  it("shows a group's active subjects compactly, marking the user's own", async () => {
    renderAt('/logbooks/g-personal')
    const list = await screen.findByRole('list', { name: 'Participants' })
    expect(list).toHaveTextContent('Alex Example(you)')
    expect(list).not.toHaveTextContent('Old Friend')
  })

  it('lets owners and editors manage subjects on their own page', async () => {
    renderAt('/logbooks/g-personal/participants')
    const list = await screen.findByRole('list', { name: 'Participants' })
    expect(within(list).getByText('You')).toBeInTheDocument()
    expect(
      within(list).getByRole('link', { name: 'Edit Alex Example' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/participants/s-me/edit')
    expect(
      screen.getByRole('link', { name: 'Add participant' }),
    ).toHaveAttribute('href', '/logbooks/g-personal/participants/new')

    expect(screen.queryByText('Old Friend')).not.toBeInTheDocument()
    screen
      .getByRole('button', { name: 'Show archived participants (1)' })
      .click()
    expect(
      await screen.findByRole('list', { name: 'Archived participants' }),
    ).toHaveTextContent('Old Friend')
  })

  it('shows viewers the subjects but not their management', async () => {
    renderAt('/logbooks/g-diet')
    const list = await screen.findByRole('list', { name: 'Participants' })
    expect(list).toHaveTextContent('Kim')
    // Viewers get the menu, but only with what they may use.
    await userEvent.click(screen.getByRole('button', { name: 'Options' }))
    const menu = await screen.findByRole('menu')
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent),
    ).toEqual(['Members', 'Privacy', 'Export CSV'])
  })

  it('keeps viewers out of subject management', async () => {
    renderAt('/logbooks/g-diet/participants')
    expect(
      await screen.findByText(
        "Only the logbook's owner and editors can manage participants.",
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Add participant' }),
    ).not.toBeInTheDocument()
  })

  it('shows viewers the group without editing', async () => {
    renderAt('/logbooks/g-diet')
    await screen.findByRole('heading', { name: 'Diet Challenge' })
    expect(screen.getByText('Viewer')).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Edit logbook/ }),
    ).not.toBeInTheDocument()
  })

  it('does not show viewers the edit form', async () => {
    renderAt('/logbooks/g-diet/edit')
    await screen.findByText(
      "Only the logbook's owner and editors can change it.",
    )
    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('shows a not-found page for groups the user is not in', async () => {
    renderAt('/logbooks/someone-elses')
    expect(
      await screen.findByRole('heading', { name: 'Logbook not found' }),
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
    await screen.findByRole('heading', { name: 'Logbooks' })
    expect(router.state.location.pathname).toBe('/logbooks')
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
    renderAt('/logbooks')
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})
