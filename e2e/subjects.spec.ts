import { expect, test, type Page } from '@playwright/test'

import { deleteOwnedGroups, users } from './support/local-supabase'
import { logIn } from './support/login'

test('a group shows its subjects; archived ones only on request', async ({
  page,
}) => {
  await page.goto('/groups/b0000000-0000-0000-0000-000000000001') // Kids

  const subjects = page.getByRole('list', { name: 'Subjects' })
  await expect(subjects.getByRole('listitem')).toHaveText([/^MIMia/, /^NONoah/])
  await expect(page.getByText('Biscuit (dog)')).toHaveCount(0)

  await page.getByRole('button', { name: 'Show archived subjects (1)' }).click()
  await expect(
    page.getByRole('list', { name: 'Archived subjects' }),
  ).toContainText('Biscuit (dog)')
})

// Ari's changes stay in a group the test creates (and deletes) and in Ari's
// own display name, so it runs once rather than per device.
test.describe('managing subjects', () => {
  // One after the other: both use Ari, and the cleanup deletes Ari's groups.
  test.describe.configure({ mode: 'serial' })
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  test.afterEach(async () => {
    await deleteOwnedGroups(users.ari.email)
  })

  async function setDisplayName(page: Page, name: string) {
    await page.goto('/profile')
    await page.getByLabel('Display name').fill(name)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('status')).toHaveText('Saved.')
  }

  async function openPersonalGroup(page: Page) {
    await page.goto('/groups')
    await page.getByRole('link', { name: /^Personal/ }).click()
    const subjects = page.getByRole('list', { name: 'Subjects' })
    await expect(subjects).toBeVisible()
    return subjects
  }

  test('subjects can be added, edited, archived and restored', async ({
    page,
  }) => {
    await logIn(page, users.ari.email)
    await page.getByRole('link', { name: 'New group' }).click()
    await page.getByLabel('Name').fill('Ari Kids')
    await page.getByRole('button', { name: 'Create group' }).click()
    await expect(
      page.getByText('No subjects yet. Add who or what you measure here'),
    ).toBeVisible()

    // Add, with a birthdate and the suggested first colour.
    await page.getByRole('link', { name: 'Add subject' }).click()
    await expect(page.getByRole('radio', { name: 'Blue' })).toBeChecked()
    await page.getByLabel('Name').fill('Theo')
    await page.getByLabel('Birthdate (optional)').fill('2099-01-01')
    await page.getByRole('button', { name: 'Add subject' }).click()
    await expect(
      page.getByText("A birthdate can't be in the future."),
    ).toBeVisible()
    await page.getByLabel('Birthdate (optional)').fill('2021-03-14')
    await page.getByRole('button', { name: 'Add subject' }).click()

    const subjects = page.getByRole('list', { name: 'Subjects' })
    await expect(subjects).toContainText('Theo')
    await expect(subjects).toContainText(/\d+ years/)

    // The next one starts with the next colour.
    await page.getByRole('link', { name: 'Add subject' }).click()
    await expect(page.getByRole('radio', { name: 'Orange' })).toBeChecked()
    await page.getByLabel('Name').fill('Ivy')
    await page.getByRole('button', { name: 'Add subject' }).click()
    await expect(subjects.getByRole('listitem')).toHaveCount(2)

    // Edit
    await page.getByRole('link', { name: 'Edit Theo' }).click()
    await page.getByLabel('Name').fill('Theodore')
    await page.getByTitle('Green').click()
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(subjects).toContainText('Theodore')

    // Archive and restore
    await page.getByRole('link', { name: 'Edit Ivy' }).click()
    await page.getByRole('button', { name: 'Archive subject' }).click()
    await expect(subjects.getByRole('listitem')).toHaveCount(1)
    await page
      .getByRole('button', { name: 'Show archived subjects (1)' })
      .click()
    await page
      .getByRole('list', { name: 'Archived subjects' })
      .getByRole('link', { name: 'Edit Ivy' })
      .click()
    await page.getByRole('button', { name: 'Restore subject' }).click()
    await expect(subjects.getByRole('listitem')).toHaveCount(2)
  })

  test("a linked subject follows the user's display name until renamed", async ({
    page,
  }) => {
    await logIn(page, users.ari.email)
    try {
      await setDisplayName(page, 'Ari Renamed')
      let subjects = await openPersonalGroup(page)
      await expect(subjects.getByRole('listitem')).toHaveText([
        /Ari Renamed\s*You/,
      ])

      await page.getByRole('link', { name: 'Edit Ari Renamed' }).click()
      await expect(
        page.getByText('Follows your display name until you rename it here.'),
      ).toBeVisible()
      await page.getByLabel('Name').fill('Me')
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(subjects).toContainText('Me')

      await setDisplayName(page, 'Ari Again')
      subjects = await openPersonalGroup(page)
      await expect(subjects).toContainText('Me')
      await expect(subjects).not.toContainText('Ari Again')
    } finally {
      // Back to the seed state: the subject follows the display name again.
      await setDisplayName(page, users.ari.displayName)
      const subjects = await openPersonalGroup(page)
      await subjects.getByRole('link', { name: /^Edit / }).click()
      await page.getByLabel('Name').fill(users.ari.displayName)
      await page.getByRole('button', { name: 'Save changes' }).click()
      await expect(subjects).toContainText(users.ari.displayName)
    }
  })
})
