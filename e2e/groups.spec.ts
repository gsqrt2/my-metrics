import { expect, test } from '@playwright/test'

import { deleteOwnedGroups, users } from './support/local-supabase'
import { logIn } from './support/login'

test('the group list shows the default group first, then the shared ones', async ({
  page,
}) => {
  await page.goto('/groups')

  const groups = page
    .getByRole('list', { name: 'Your groups' })
    .getByRole('link')
  await expect(groups).toHaveText([/^Personal/, /^Diet Challenge/, /^Kids/])
  await expect(groups.first()).toContainText('1 member')

  await groups.filter({ hasText: 'Diet Challenge' }).click()
  await expect(page).toHaveURL(
    /\/groups\/b0000000-0000-0000-0000-000000000002$/,
  )
  await expect(
    page.getByRole('heading', { level: 1, name: 'Diet Challenge' }),
  ).toBeVisible()
  await expect(page.getByText('Owner')).toBeVisible()
  await expect(page.getByText('3 members')).toBeVisible()
  await expect(page.getByText(/Oct 5\D+Dec 27, 2026/)).toBeVisible()

  // Back to the list without the menu, which is folded away on phones.
  await page.getByRole('main').getByRole('link', { name: 'Groups' }).click()
  await expect(page).toHaveURL(/\/groups$/)
})

test.describe('creating and editing', () => {
  // Creates groups for Jo, so it runs once rather than per device.
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too,
  // and the phone run's cleanup would delete the desktop test's group mid-test.
  test.afterEach(async ({ isMobile }) => {
    if (!isMobile) await deleteOwnedGroups(users.jo.email)
  })

  test('a new group can be created with a duration and then edited', async ({
    page,
  }) => {
    await logIn(page, users.jo.email)
    await page.getByRole('link', { name: 'New group' }).click()

    await page.getByLabel('Name').fill('Summer Steps')
    await page
      .getByLabel('Description (optional)')
      .fill('Daily steps until the holidays.')
    await page.getByLabel('Runs between two dates').check()
    await page.getByLabel('Start date').fill('2027-06-01')
    await page.getByLabel('End date').fill('2027-05-31')
    await page.getByRole('button', { name: 'Create group' }).click()
    await expect(
      page.getByText("The end date can't be before the start date."),
    ).toBeVisible()

    await page.getByLabel('End date').fill('2027-08-31')
    await page.getByRole('button', { name: 'Create group' }).click()

    await expect(page).toHaveURL(/\/groups\/[0-9a-f-]{36}$/)
    await expect(
      page.getByRole('heading', { name: 'Summer Steps' }),
    ).toBeVisible()
    await expect(
      page.getByText('Daily steps until the holidays.'),
    ).toBeVisible()
    await expect(page.getByText('Owner')).toBeVisible()
    await expect(page.getByText(/Jun 1\D+Aug 31, 2027/)).toBeVisible()

    await page.getByRole('link', { name: 'Edit group' }).click()
    await expect(page.getByLabel('Name')).toHaveValue('Summer Steps')
    await page.getByLabel('Name').fill('Summer Steps 2027')
    await page.getByLabel('Runs between two dates').uncheck()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(
      page.getByRole('heading', { name: 'Summer Steps 2027' }),
    ).toBeVisible()
    await expect(page.getByText(/Aug 31/)).toHaveCount(0)

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Groups' })
      .click()
    await expect(
      page.getByRole('list', { name: 'Your groups' }).getByRole('link'),
    ).toHaveText([/^Personal/, /^Summer Steps 2027/])
  })
})
