import { expect, test, type Browser, type Page } from '@playwright/test'

import {
  clearMailbox,
  latestEmailText,
  restoreSeedPassword,
  SEED_PASSWORD,
  users,
} from './support/local-supabase'
import { logIn } from './support/login'

// Each test logs in as the account it changes and puts it back afterwards.
test.use({ storageState: { cookies: [], origins: [] } })

// These change shared seed accounts, so run them once rather than per device.
test.beforeEach(({ isMobile }) => {
  test.skip(isMobile, 'runs on desktop only')
})

function emailLink(text: string, path: string) {
  return text.match(new RegExp(`https?://\\S+/${path}\\?\\S+`))?.[0]
}

// Requests the change in `page` and confirms it by opening the emailed link in
// a separate browser, as if the email were read on another device.
async function changeEmail(
  page: Page,
  browser: Browser,
  from: string,
  to: string,
) {
  // Supabase sends at most one email per account per second (max_frequency),
  // and the previous change may have just sent one.
  await page.waitForTimeout(1_100)
  await clearMailbox(to)
  await clearMailbox(from)
  await page.goto('/profile')
  await page.getByLabel('New email address').fill(to)
  await page.getByRole('button', { name: 'Send confirmation link' }).click()
  await expect(
    page.getByText(`We've sent a confirmation link to ${to}`),
  ).toBeVisible()

  const link = emailLink(await latestEmailText(to), 'confirm-email')
  expect(link, 'confirmation link in the email').toBeTruthy()

  const otherDevice = await browser.newContext()
  try {
    const other = await otherDevice.newPage()
    await other.goto(link!)
    await expect(
      other.getByRole('heading', { name: 'Email address changed' }),
    ).toBeVisible()
    await expect(other.getByText(to)).toBeVisible()
  } finally {
    await otherDevice.close()
  }

  // The original tab picks up the change once reloaded.
  await page.reload()
  await expect(page.getByText(`You log in with ${to}`)).toBeVisible()
  await expect(page.getByText("We've sent a confirmation link")).toHaveCount(0)
}

test('the display name can be changed', async ({ page }) => {
  await logIn(page, users.sam.email)
  await page.goto('/profile')

  const field = page.getByLabel('Display name')
  await expect(field).toHaveValue(users.sam.displayName)
  try {
    await field.fill('   ')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Enter a display name.')).toBeVisible()

    await field.fill('  Sam Renamed ')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('Saved.')
    await expect(
      page.getByRole('button', { name: /Sam Renamed/ }).first(),
    ).toBeVisible()

    await page.reload()
    await expect(page.getByLabel('Display name')).toHaveValue('Sam Renamed')
  } finally {
    await page.getByLabel('Display name').fill(users.sam.displayName)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('Saved.')
  }
})

test('a new email address takes effect once confirmed by link', async ({
  page,
  browser,
}) => {
  const newEmail = 'lee.changed@example.com'
  await logIn(page, users.lee.email)

  await changeEmail(page, browser, users.lee.email, newEmail)
  try {
    // The old address gets a notice.
    expect(await latestEmailText(users.lee.email)).toContain(
      `changed from ${users.lee.email} to ${newEmail}`,
    )
  } finally {
    await changeEmail(page, browser, newEmail, users.lee.email)
  }
})

test('the password can be changed after confirming the current one', async ({
  page,
}) => {
  const newPassword = `robin-${Date.now()}`
  await logIn(page, users.robin.email)
  await page.goto('/profile')

  await page.getByLabel('Current password').fill('not-my-password')
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByLabel('Repeat new password').fill(newPassword)
  await page.getByRole('button', { name: 'Change password' }).click()
  await expect(
    page.getByText("That's not your current password."),
  ).toBeVisible()

  try {
    await page.getByLabel('Current password').fill(SEED_PASSWORD)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('status')).toHaveText('Password changed.')

    // Still logged in, and the new password works for the next login.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
    await page.evaluate(() => localStorage.clear())
    await logIn(page, users.robin.email, newPassword)
  } finally {
    await restoreSeedPassword(users.robin.email, newPassword).catch(() => {})
  }
})
