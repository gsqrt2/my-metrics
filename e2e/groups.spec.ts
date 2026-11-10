import { expect, test } from '@playwright/test'

import { deleteOwnedGroups, users } from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

test('the group list shows the default group first, then the shared ones', async ({
  page,
}) => {
  await page.goto('/logbooks')

  const groups = page
    .getByRole('list', { name: 'Your logbooks' })
    .getByRole('link')
  await expect(groups).toHaveText([/^Personal/, /^Diet Challenge/, /^Kids/])
  await expect(groups.first()).toContainText('1 member')

  await groups.filter({ hasText: 'Diet Challenge' }).click()
  await expect(page).toHaveURL(
    /\/logbooks\/b0000000-0000-0000-0000-000000000002$/,
  )
  await expect(
    page.getByRole('heading', { level: 1, name: 'Diet Challenge' }),
  ).toBeVisible()
  await expect(page.getByText('Owner')).toBeVisible()
  await expect(page.getByText('3 members')).toBeVisible()
  await expect(page.getByText(/05\/10\/2026\D+27\/12\/2026/)).toBeVisible()

  // Back to the list without the menu, which is folded away on phones.
  await page.getByRole('main').getByRole('link', { name: 'Logbooks' }).click()
  await expect(page).toHaveURL(/\/logbooks$/)
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
    await page.getByRole('link', { name: 'New logbook' }).click()

    await page.getByLabel('Name').fill('Summer Steps')
    await page
      .getByLabel('Description (optional)')
      .fill('Daily steps until the holidays.')
    await page.getByLabel('Runs between two dates').check()
    await page.getByLabel('Everyone logs only for themselves').check()
    await page.getByLabel('Start date', { exact: true }).fill('1/6/2027')
    await page.getByLabel('End date', { exact: true }).fill('31/06/2027')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(page.getByText('Enter a date as dd/mm/yyyy.')).toBeVisible()
    await page.getByLabel('End date', { exact: true }).fill('31/05/2027')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(
      page.getByText("The end date can't be before the start date."),
    ).toBeVisible()

    await page.getByLabel('End date', { exact: true }).fill('31/08/2027')
    await page.getByRole('button', { name: 'Create logbook' }).click()

    await expect(page).toHaveURL(/\/logbooks\/[0-9a-f-]{36}$/)
    await expect(
      page.getByRole('heading', { name: 'Summer Steps' }),
    ).toBeVisible()
    await expect(
      page.getByText('Daily steps until the holidays.'),
    ).toBeVisible()
    await expect(page.getByText('Owner')).toBeVisible()
    await expect(page.getByText(/01\/06\/2027\D+31\/08\/2027/)).toBeVisible()

    await openLogbookOption(page, 'Edit logbook')
    await expect(page.getByLabel('Name')).toHaveValue('Summer Steps')
    // The owner's setting (§5) was saved, and can be switched off again.
    await expect(
      page.getByLabel('Everyone logs only for themselves'),
    ).toBeChecked()
    await page.getByLabel('Everyone logs only for themselves').uncheck()
    await page.getByLabel('Name').fill('Summer Steps 2027')
    await page.getByLabel('Runs between two dates').uncheck()
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(
      page.getByRole('heading', { name: 'Summer Steps 2027' }),
    ).toBeVisible()
    await expect(page.getByText(/31\/08\/2027/)).toHaveCount(0)
    await openLogbookOption(page, 'Edit logbook')
    await expect(
      page.getByLabel('Everyone logs only for themselves'),
    ).not.toBeChecked()
    await page.getByRole('link', { name: 'Cancel' }).click()

    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Logbooks' })
      .click()
    await expect(
      page.getByRole('list', { name: 'Your logbooks' }).getByRole('link'),
    ).toHaveText([/^Personal/, /^Summer Steps 2027/])
  })
})
