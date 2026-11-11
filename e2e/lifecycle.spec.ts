import { expect, test } from '@playwright/test'

import { deleteOwnedGroups, users } from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

// FR-11: Zoe archives a logbook (read-only), restores it, then deletes it.
// Runs once rather than per device.
test.describe('archiving and deleting', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  test.afterEach(async ({ isMobile }) => {
    if (!isMobile) await deleteOwnedGroups(users.zoe.email)
  })

  test('the owner archives, restores and deletes a logbook', async ({
    page,
  }) => {
    await logIn(page, users.zoe.email)

    // The personal logbook is neither archived nor deleted.
    await page.getByRole('link', { name: /^Personal/ }).click()
    await openLogbookOption(page, 'Edit logbook')
    await expect(
      page.getByText("Your personal logbook can't be archived or deleted"),
    ).toBeVisible()

    await page.goto('/logbooks/new')
    await page.getByLabel('Name').fill('Zoe Challenge')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await expect(page).toHaveURL(/\/logbooks\/[0-9a-f-]{36}$/)
    const logbookUrl = page.url()

    // Archive: read-only, and listed apart.
    await openLogbookOption(page, 'Edit logbook')
    await page.getByRole('button', { name: 'Archive logbook…' }).click()
    await page
      .getByRole('group', { name: 'Confirm archiving' })
      .getByRole('button', { name: 'Archive' })
      .click()
    await expect(page).toHaveURL(logbookUrl)
    const notice = page.getByRole('region', { name: 'Archived' })
    await expect(notice).toContainText(
      /Archived on \d{2}\/\d{2}\/\d{4}\. It's read-only/,
    )
    await expect(
      page.getByText('Archived. Zoe Challenge is now read-only.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Options' }).click()
    await expect(page.getByRole('menuitem')).toHaveText([
      'Members',
      'Privacy',
      'Export CSV',
    ])
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('main').getByRole('button', { name: 'Log entry' }),
    ).toHaveCount(0)

    await page.goto('/logbooks')
    await expect(
      page
        .getByRole('list', { name: 'Archived logbooks' })
        .getByRole('listitem'),
    ).toHaveText([/Zoe Challenge/])
    await expect(
      page.getByRole('list', { name: 'Your logbooks' }),
    ).not.toContainText('Zoe Challenge')

    // Restore.
    await page.goto(logbookUrl)
    await notice.getByRole('button', { name: 'Restore' }).click()
    await expect(notice).toHaveCount(0)
    await expect(
      page.getByText('Restored. Zoe Challenge can be changed again.'),
    ).toBeVisible()

    // Delete, after typing the name.
    await openLogbookOption(page, 'Edit logbook')
    await page.getByRole('button', { name: 'Delete logbook…' }).click()
    const confirm = page.getByRole('group', { name: 'Confirm deleting' })
    const deleteButton = confirm.getByRole('button', {
      name: 'Delete for good',
    })
    await expect(deleteButton).toBeDisabled()
    await confirm
      .getByLabel("Type the logbook's name to confirm")
      .fill('Zoe Challenge')
    await deleteButton.click()
    await expect(page).toHaveURL(/\/logbooks$/)
    await expect(page.getByText('Deleted Zoe Challenge.')).toBeVisible()
    await expect(page.getByRole('main')).not.toContainText('Zoe Challenge')
    await page.goto(logbookUrl)
    await expect(
      page.getByRole('heading', { name: 'Logbook not found' }),
    ).toBeVisible()
  })
})
