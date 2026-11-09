import { expect, test } from '@playwright/test'

import { deleteOwnedGroups, users } from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

test('a logbook shows its metrics, with details on the metrics page', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge

  await expect(
    page.getByRole('list', { name: 'Metrics' }).getByRole('listitem'),
  ).toHaveText(['Weight (kg)', 'Waist (cm)', 'Body fat (%)'])

  await openLogbookOption(page, 'Metrics')
  const metrics = page.getByRole('list', { name: 'Metrics' })
  await expect(metrics.getByRole('listitem').first()).toContainText(
    '1 decimal · 40–250',
  )
})

// Creates a logbook for Noa and deletes it afterwards, so it runs once rather
// than per device.
test.describe('managing metrics', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too.
  test.afterEach(async ({ isMobile }) => {
    if (!isMobile) await deleteOwnedGroups(users.noa.email)
  })

  test('metrics can be picked from suggestions, added, reordered, edited, archived and deleted', async ({
    page,
  }) => {
    await logIn(page, users.noa.email)
    await page.getByRole('link', { name: 'New logbook' }).click()
    await page.getByLabel('Name').fill('Noa Fitness')
    await page.getByRole('button', { name: 'Create logbook' }).click()

    // Suggestions, several in a row
    await page.getByRole('link', { name: 'Choose what to measure' }).click()
    await expect(
      page.getByRole('heading', { name: 'No metrics yet' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Weight (kg)' }).click()
    await expect(
      page.getByRole('heading', { name: 'Suggested metrics' }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Waist (cm)' }).click()
    const metrics = page.getByRole('list', { name: 'Metrics' })
    await expect(metrics.getByRole('listitem')).toHaveCount(2)
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(
      page.getByRole('heading', { name: 'Suggested metrics' }),
    ).toHaveCount(0)

    // A custom metric; names are unique within the logbook
    await page.getByRole('link', { name: 'Add metric' }).click()
    await page.getByLabel('Name').fill('weight')
    await page.getByRole('button', { name: 'Add metric' }).click()
    await expect(
      page.getByText('This logbook already has a metric with that name.'),
    ).toBeVisible()
    await page.getByLabel('Name').fill('Steps')
    await page.getByLabel('Unit (optional)').fill('steps')
    await page.getByLabel('Decimals').selectOption('0')
    await page.getByLabel('Minimum').fill('0')
    await page.getByRole('button', { name: 'Add metric' }).click()
    await expect(metrics.getByRole('listitem')).toHaveText([
      /^Weight \(kg\)/,
      /^Waist \(cm\)/,
      /^Steps \(steps\)Whole numbers · at least 0/,
    ])

    // Reorder
    await page.getByRole('button', { name: 'Move Steps up' }).click()
    await expect(metrics.getByRole('listitem')).toHaveText([
      /^Weight/,
      /^Steps/,
      /^Waist/,
    ])
    await page.reload()
    await expect(metrics.getByRole('listitem')).toHaveText([
      /^Weight/,
      /^Steps/,
      /^Waist/,
    ])

    // Edit, with the limits checked
    await page.getByRole('link', { name: 'Edit Waist' }).click()
    await page.getByLabel('Minimum').fill('90')
    await page.getByLabel('Maximum').fill('50,5')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(
      page.getByText("The maximum can't be below the minimum."),
    ).toBeVisible()
    await page.getByLabel('Minimum').fill('40')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(metrics).toContainText('40–50.5')

    // Archive
    await page.getByRole('link', { name: 'Edit Waist' }).click()
    await page.getByRole('button', { name: 'Archive metric' }).click()
    await expect(metrics.getByRole('listitem')).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: 'Show archived metrics (1)' }),
    ).toBeVisible()

    // Delete, after confirming
    await page.getByRole('link', { name: 'Edit Steps' }).click()
    await page.getByRole('button', { name: 'Delete metric…' }).click()
    await page.getByRole('button', { name: 'Keep it' }).click()
    await page.getByRole('button', { name: 'Delete metric…' }).click()
    await page.getByRole('button', { name: 'Delete for good' }).click()
    await expect(metrics.getByRole('listitem')).toHaveText([/^Weight/])

    // The logbook page lists the active ones
    await page
      .getByRole('main')
      .getByRole('link', { name: 'Noa Fitness' })
      .click()
    await expect(
      page.getByRole('list', { name: 'Metrics' }).getByRole('listitem'),
    ).toHaveText(['Weight (kg)'])
  })
})
