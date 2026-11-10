import { expect, test, type Browser, type Page } from '@playwright/test'

import {
  deleteAccounts,
  deleteOwnedGroups,
  users,
} from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

// Tom invites, a newcomer and Uma join. Tom's logbook and the new account are
// deleted afterwards. Runs once rather than per device.
test.describe('invitations', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too.
  test.afterEach(async ({ isMobile }) => {
    if (isMobile) return
    await deleteOwnedGroups(users.tom.email)
    await deleteAccounts('e2e-joiner-%@example.com')
  })

  // Opens a link in a separate browser, as someone else on another device.
  async function visit(browser: Browser, link: string) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(link)
    return { page, close: () => context.close() }
  }

  async function participantChips(page: Page) {
    return page
      .getByRole('list', { name: 'Participants' })
      .getByRole('listitem')
  }

  test('people join through an invite link, with a new or an existing account', async ({
    page,
    browser,
  }) => {
    // Tom's logbook, with a participant without an account.
    await logIn(page, users.tom.email)
    await page.getByRole('link', { name: 'New logbook' }).click()
    await page.getByLabel('Name').fill('Tom Team')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(page).toHaveURL(/\/logbooks\/[0-9a-f-]{36}$/)
    const logbookUrl = page.url()
    await openLogbookOption(page, 'Participants')
    await page.getByRole('link', { name: 'Add participant' }).click()
    await page.getByLabel('Name').fill('Grandpa')
    await page.getByRole('button', { name: 'Add participant' }).click()
    await page.goto(logbookUrl)

    // A viewer link.
    await openLogbookOption(page, 'Invite people')
    await page.getByRole('button', { name: 'Create link' }).click()
    const link = await page.getByLabel('Your new link').inputValue()
    expect(link).toMatch(/\/join\/[\w-]{24}$/)
    await expect(
      page.getByRole('list', { name: 'Open invites' }).getByRole('listitem'),
    ).toHaveText([/Viewer link/])

    // Someone new creates an account and tracks themselves.
    const newcomer = await visit(browser, link)
    const email = `e2e-joiner-${Date.now()}@example.com`
    try {
      const p = newcomer.page
      await expect(
        p.getByRole('heading', { name: 'Join Tom Team' }),
      ).toBeVisible()
      await expect(
        p.getByText('Tom Example invited you as a viewer'),
      ).toBeVisible()
      await p.getByLabel('Your name', { exact: true }).fill('Nia New')
      await p.getByLabel('Email', { exact: true }).fill(email)
      await p.getByLabel('Password', { exact: true }).fill('short')
      await p.getByLabel('Repeat password').fill('short')
      await p.getByRole('button', { name: 'Create account and join' }).click()
      await expect(p.getByText('Use at least 8 characters.')).toBeVisible()
      await p.getByLabel('Password', { exact: true }).fill('nia-password')
      await p.getByLabel('Repeat password').fill('nia-password')
      await p.getByRole('button', { name: 'Create account and join' }).click()

      await expect(
        p.getByRole('heading', { level: 1, name: 'Tom Team' }),
      ).toBeVisible()
      await expect(p.getByText('Viewer', { exact: true })).toBeVisible()
      await expect(await participantChips(p)).toContainText([
        /Nia New\s*\(you\)/,
      ])
    } finally {
      await newcomer.close()
    }

    // Uma has an account: she logs in from the invite and comes back to it,
    // then asks to be Grandpa.
    const uma = await visit(browser, link)
    try {
      const p = uma.page
      await p.getByRole('link', { name: 'Log in to join' }).click()
      await expect(p.getByRole('heading', { name: 'Log in' })).toBeVisible()
      await p.getByLabel('Email').fill(users.uma.email)
      await p.getByLabel('Password').fill('password')
      await p.getByRole('button', { name: 'Log in' }).click()
      await expect(
        p.getByRole('heading', { name: 'Join Tom Team' }),
      ).toBeVisible()
      await expect(p.getByText('Joining as Uma Example')).toBeVisible()
      await p.getByLabel("I'm already tracked here").check()
      await expect(p.getByLabel('Who are you?')).toHaveValue(/.+/)
      await p.getByRole('button', { name: 'Join Tom Team' }).click()
      await expect(
        p.getByRole('heading', { level: 1, name: 'Tom Team' }),
      ).toBeVisible()
    } finally {
      await uma.close()
    }

    // Tom is told, and approves.
    await page.goto(logbookUrl)
    await page
      .getByText('1 person is waiting to be linked to a participant.')
      .waitFor()
    await page.getByRole('link', { name: 'Review' }).click()
    await expect(
      page.getByRole('list', { name: 'Link requests' }),
    ).toContainText("Uma Example says they're Grandpa.")
    await page.getByRole('button', { name: 'Approve' }).click()
    await expect(page.getByRole('list', { name: 'Link requests' })).toHaveCount(
      0,
    )
    await page.goto(logbookUrl)
    await expect(page.getByText('3 members')).toBeVisible()

    // A withdrawn link no longer works.
    await openLogbookOption(page, 'Invite people')
    await page.getByRole('button', { name: 'Withdraw' }).click()
    await expect(page.getByText('No open invites.')).toBeVisible()
    const late = await visit(browser, link)
    try {
      await expect(
        late.page.getByRole('heading', { name: 'Invite not available' }),
      ).toBeVisible()
      await expect(
        late.page.getByText('This invite was withdrawn.'),
      ).toBeVisible()
    } finally {
      await late.close()
    }
  })
})
