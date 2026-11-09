import { expect, test } from '@playwright/test'

import { users } from './support/local-supabase'

test('opens the group list and navigates to the profile', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/logbooks$/)
  await expect(page.getByRole('heading', { name: 'Logbooks' })).toBeVisible()

  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click()
  }
  await expect(
    page.getByRole('button', { name: new RegExp(users.alex.displayName) }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click()

  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})
