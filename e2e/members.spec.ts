import { expect, test, type Page } from '@playwright/test'

import { addMember, deleteOwnedGroups, users } from './support/local-supabase'
import { logIn } from './support/login'

// Val owns a logbook the test creates; Wes is added to it. Both logbooks are
// deleted afterwards, whoever owns them by then. Runs once rather than per
// device, one test after the other.
test.describe('members', () => {
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too.
  test.afterEach(async ({ isMobile }) => {
    if (isMobile) return
    await deleteOwnedGroups(users.val.email)
    await deleteOwnedGroups(users.wes.email)
  })

  // A logbook of Val's with Wes in it; returns its address.
  async function valsLogbook(page: Page) {
    await logIn(page, users.val.email)
    await page.getByRole('link', { name: 'New logbook' }).click()
    await page.getByLabel('Name').fill('Val Club')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(page).toHaveURL(/\/logbooks\/[0-9a-f-]{36}$/)
    const url = page.url()
    await addMember(url, users.val.email, null) // her own participant
    await addMember(url, users.wes.email, 'viewer')
    await page.reload()
    return url
  }

  test('the owner sees the members, changes roles and removes members', async ({
    page,
  }) => {
    const url = await valsLogbook(page)
    await page.getByRole('link', { name: '2 members' }).click()

    const members = page.getByRole('list', { name: 'Members' })
    await expect(members.getByRole('listitem')).toHaveText([
      /^Val Example\s*\(you\)\s*Owner/,
      /^Wes Example/,
    ])
    const role = members.getByLabel('Role of Wes Example')
    await expect(role).toHaveValue('viewer')
    await role.selectOption('editor')
    await page.reload()
    await expect(members.getByLabel('Role of Wes Example')).toHaveValue(
      'editor',
    )

    await members.getByRole('button', { name: 'Remove' }).click()
    await expect(
      page.getByText('Their entries stay in the logbook'),
    ).toBeVisible()
    await page
      .getByRole('group', { name: 'Confirm removing Wes Example' })
      .getByRole('button', { name: 'Remove' })
      .click()
    await expect(members.getByRole('listitem')).toHaveCount(1)

    // Wes's participant stays, no longer linked to him.
    await page.goto(url)
    await expect(page.getByText('1 member')).toBeVisible()
    await expect(
      page.getByRole('list', { name: 'Participants' }),
    ).toContainText('Wes Example')
  })

  test('ownership can be handed over, and then the former owner can leave', async ({
    page,
  }) => {
    await valsLogbook(page)
    await page.getByRole('link', { name: '2 members' }).click()
    await expect(page.getByText("As the owner you can't leave.")).toBeVisible()

    const members = page.getByRole('list', { name: 'Members' })
    await members.getByRole('button', { name: 'Make owner' }).click()
    await page.getByRole('button', { name: 'Make Wes Example owner' }).click()
    await expect(members.getByRole('listitem')).toHaveText([
      /^Wes Example\s*Owner/,
      /^Val Example\s*\(you\)\s*Editor/,
    ])

    // Now Val can leave; her participant and entries go with her if she says so.
    await page.getByLabel('Delete them').check()
    await page.getByRole('button', { name: 'Leave logbook…' }).click()
    await expect(
      page.getByText('Your entries are deleted for good.'),
    ).toBeVisible()
    await page
      .getByRole('group', { name: 'Confirm leaving' })
      .getByRole('button', { name: 'Leave' })
      .click()
    await expect(page).toHaveURL(/\/logbooks$/)
    await expect(
      page.getByRole('list', { name: 'Your logbooks' }).getByRole('link'),
    ).toHaveText([/^Personal/])
  })
})
