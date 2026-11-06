import { expect, test } from '@playwright/test'

import {
  clearMailbox,
  latestEmailText,
  restoreSeedPassword,
  SEED_PASSWORD,
  users,
} from './support/local-supabase'

// These tests start logged out.
test.use({ storageState: { cookies: [], origins: [] } })

test('logged-out visitors are sent to the login page', async ({ page }) => {
  await page.goto('/profile')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible()
  await expect(page.getByText(/sign up/i)).toHaveCount(0)
})

test('a wrong password is rejected', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(users.alex.email)
  await page.getByLabel('Password').fill('not-the-password')
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByText('Wrong email or password.')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)
})

test('logging in returns to the requested page, logging out ends the session', async ({
  page,
  isMobile,
}) => {
  await page.goto('/profile')
  await page.getByLabel('Email').fill(users.alex.email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()

  if (isMobile) await page.getByRole('button', { name: 'Open menu' }).click()
  await page
    .getByRole('button', { name: new RegExp(users.alex.displayName) })
    .click()
  await page.getByRole('menuitem', { name: 'Log out' }).click()

  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/groups')
  await expect(page).toHaveURL(/\/login$/)
})

test('a forgotten password can be reset through the emailed link', async ({
  page,
  isMobile,
}) => {
  // Kim's password changes here, so run this once rather than per device.
  test.skip(isMobile, 'runs on desktop only')

  const newPassword = `reset-${Date.now()}`
  await clearMailbox(users.kim.email)

  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(
    page.getByRole('heading', { name: 'Reset your password' }),
  ).toBeVisible()
  await page.getByLabel('Email').fill(users.kim.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(
    page.getByText(`If an account exists for ${users.kim.email}`),
  ).toBeVisible()

  const email = await latestEmailText(users.kim.email)
  const link = email.match(/https?:\/\/\S+\/reset-password\?\S+/)?.[0]
  expect(link, 'reset link in the email').toBeTruthy()

  try {
    await page.goto(link!)
    await expect(
      page.getByRole('heading', { name: 'Choose a new password' }),
    ).toBeVisible()
    await page.getByLabel('New password', { exact: true }).fill(newPassword)
    await page.getByLabel('Repeat new password').fill(newPassword)
    await page.getByRole('button', { name: 'Save new password' }).click()
    await expect(
      page.getByRole('heading', { name: 'Password changed' }),
    ).toBeVisible()

    await page.getByRole('link', { name: 'Continue to your groups' }).click()
    await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible()

    // The link works only once.
    await page.evaluate(() => localStorage.clear())
    await page.goto(link!)
    await expect(
      page.getByRole('heading', { name: "This link doesn't work" }),
    ).toBeVisible()
  } finally {
    await restoreSeedPassword(users.kim.email, newPassword).catch(() => {})
  }
})
