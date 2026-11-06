import { expect, test } from '@playwright/test'

test('opens the group list and navigates to the profile', async ({
  page,
  isMobile,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/groups$/)
  await expect(page.getByRole('heading', { name: 'Groups' })).toBeVisible()

  if (isMobile) {
    await page.getByRole('button', { name: 'Open menu' }).click()
  }
  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Profile' })
    .click()

  await expect(page).toHaveURL(/\/profile$/)
  await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible()
})
