import { expect, test } from '@playwright/test'

import {
  createAccount,
  deleteAccounts,
  deleteOwnedGroups,
} from './support/local-supabase'
import { logIn } from './support/login'

// FR-3: a fresh account per run, since the test deletes it. Runs once rather
// than per device.
test.describe('deleting an account', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  let email = ''
  test.afterEach(async ({ isMobile }) => {
    if (isMobile) return
    await deleteOwnedGroups(email)
    await deleteAccounts('e2e-deleter-%@example.com')
  })

  test('is possible once no other logbook is owned, after the password', async ({
    page,
  }) => {
    email = `e2e-deleter-${Date.now()}@example.com`
    await createAccount(email, 'Dee Leter')
    await logIn(page, email)

    await page.getByRole('link', { name: 'New logbook' }).click()
    await page.getByLabel('Name').fill('Dee Club')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(page).toHaveURL(/\/logbooks\/[0-9a-f-]{36}$/)

    // Blocked while owning a logbook, with the ways out.
    await page.goto('/profile')
    const card = page.getByRole('heading', { name: 'Delete account' })
    await expect(card).toBeVisible()
    const owned = page.getByRole('list', { name: 'Logbooks you own' })
    await expect(owned.getByRole('listitem')).toHaveText([/Dee Club/])
    await expect(
      owned.getByRole('link', { name: 'Make someone else the owner' }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Delete account…' }),
    ).toHaveCount(0)

    await owned.getByRole('link', { name: 'Delete it' }).click()
    await page.getByRole('button', { name: 'Delete logbook…' }).click()
    await page.getByLabel("Type the logbook's name to confirm").fill('Dee Club')
    await page.getByRole('button', { name: 'Delete for good' }).click()
    await expect(page).toHaveURL(/\/logbooks$/)

    // Now it can go, with the password.
    await page.goto('/profile')
    await page.getByRole('button', { name: 'Delete account…' }).click()
    const confirm = page.getByRole('group', {
      name: 'Confirm deleting your account',
    })
    await confirm.getByLabel('Your password').fill('wrong-password')
    await confirm.getByRole('button', { name: 'Delete my account' }).click()
    await expect(confirm.getByText("That's not your password.")).toBeVisible()
    await confirm.getByLabel('Your password').fill('password')
    await confirm.getByRole('button', { name: 'Delete my account' }).click()

    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
    await expect(page.getByText('Your account was deleted.')).toBeVisible()
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('Password').fill('password')
    await page.getByRole('button', { name: 'Log in' }).click()
    await expect(page.getByText('Wrong email or password.')).toBeVisible()
  })
})
