import { expect, test } from '@playwright/test'

import { clearDefaultGroup, users } from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

// In the demo data Kim shows the others only the % change of her weight in
// Diet Challenge (FR-43). Alex, the owner, sees it like everyone else.
test("others see a private value only as % change, and can't log or edit it", async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge

  const weight = page.getByRole('article', { name: 'Weight (kg)' })
  await expect(
    weight.getByText('Shown as % change since the first entry'),
  ).toBeVisible()
  await expect(
    page
      .getByRole('list', { name: 'Weight: latest values' })
      .getByRole('listitem'),
  ).toContainText([
    /Alex Example\s*\d+\.\d kg/,
    /Kim Example\s*[−-]?\d+(\.\d)?%\s*% only/,
    /Lee Example/,
  ])
  // Kim's other metrics are as usual.
  await expect(
    page.getByRole('list', { name: 'Body fat: latest values' }),
  ).toContainText(/Kim Example\s*\d+\.\d %/)

  // In the entry list: % only, no edit button.
  const entries = page.getByRole('list', { name: 'Recent entries' })
  const kimsWeight = entries
    .getByRole('listitem')
    .filter({ hasText: /Weight.*Kim Example/ })
  await expect(kimsWeight.first()).toContainText('% only')
  await expect(kimsWeight.first().getByRole('link')).toHaveCount(0)

  // In the log form, Kim's weight isn't offered.
  await page.getByRole('button', { name: 'Log entry' }).first().click()
  const sheet = page.getByRole('dialog', { name: 'Log entry' })
  await sheet.getByLabel('Participant').selectOption({ label: 'Kim Example' })
  await expect(sheet.getByLabel('Weight (kg)')).toHaveCount(0)
  await expect(sheet.getByLabel('Body fat (%)')).toBeVisible()
  await expect(
    sheet.getByText(
      'Kim Example keeps Weight private, so only Kim Example can log it.',
    ),
  ).toBeVisible()
})

test.describe('choosing what others see', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too.
  test.afterEach(async ({ isMobile }) => {
    if (!isMobile) await clearDefaultGroup(users.yan.email)
  })

  test('members set a metric of their own participant to "% only" and back', async ({
    page,
  }) => {
    await logIn(page, users.yan.email)
    await page.getByRole('link', { name: /^Personal/ }).click()
    await openLogbookOption(page, 'Metrics')
    await page.getByRole('button', { name: 'Weight (kg)' }).click()
    await expect(page.getByRole('list', { name: 'Metrics' })).toContainText(
      'Weight',
    )
    await page.getByRole('main').getByRole('link').first().click() // back

    await openLogbookOption(page, 'Privacy')
    const setting = page.getByRole('group', {
      name: "What others see of Yan Example's Weight",
    })
    await expect(
      setting.getByRole('button', { name: 'Actual values' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await setting.getByRole('button', { name: '% only' }).click()
    // Saved as soon as it's chosen, and a toast says so.
    await expect(
      page.getByText(
        "Saved. Others now see only the % change of Yan Example's Weight.",
      ),
    ).toBeVisible()
    await page.reload()
    await expect(
      setting.getByRole('button', { name: '% only' }),
    ).toHaveAttribute('aria-pressed', 'true')
    await setting.getByRole('button', { name: 'Actual values' }).click()
    await page.reload()
    await expect(
      setting.getByRole('button', { name: 'Actual values' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })
})
