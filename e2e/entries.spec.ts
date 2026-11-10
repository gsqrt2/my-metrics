import { expect, test, type Locator, type Page } from '@playwright/test'

import {
  clearDefaultGroup,
  deleteOwnedGroups,
  users,
} from './support/local-supabase'
import { logIn, openLogbookOption } from './support/login'

// Fills "When" with yesterday at a given time; dates are typed dd/mm/yyyy.
async function fillYesterdayAt(form: Locator, time: string) {
  const day = new Date(Date.now() - 24 * 3600 * 1000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const when = form.getByRole('group', { name: 'When' })
  await when
    .getByLabel('Date', { exact: true })
    .fill(
      `${pad(day.getDate())}/${pad(day.getMonth() + 1)}/${day.getFullYear()}`,
    )
  await when.getByLabel('Time', { exact: true }).fill(time)
}

test('a logbook shows charts first, then its latest entries', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000001') // Kids

  const headings = page.getByRole('main').getByRole('heading', { level: 2 })
  await expect(headings).toContainText(['Charts', 'Recent entries'])

  const entries = page.getByRole('list', { name: 'Recent entries' })
  await expect(entries.getByRole('listitem')).toHaveCount(5)
  // The seed's latest measurements are this month's, for both children.
  await expect(entries.getByRole('listitem').first()).toContainText(
    /(Height|Weight)\s*\d+\.\d (cm|kg)\s*(Mia|Noah)/,
  )
  await page.getByRole('button', { name: 'Show more (45+)' }).click()
  await expect(entries.getByRole('listitem')).toHaveCount(50)
  await expect(page.getByText('Showing the latest 50 entries.')).toBeVisible()
})

test('the log entry form is readable in dark mode', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  await page.getByRole('button', { name: 'Log entry' }).first().click()
  const logbook = page
    .getByRole('dialog', { name: 'Log entry' })
    .getByLabel('Logbook')
  await expect(logbook.locator('option:checked')).toHaveText('Diet Challenge')

  // Runs in the browser; the e2e code itself is compiled without DOM globals.
  const colours = await logbook.evaluate((select) => {
    const page = select.ownerDocument
    const style = (element: typeof select) =>
      page.defaultView!.getComputedStyle(element)
    const option = style(select.querySelector('option') as typeof select)
    return {
      scheme: style(page.documentElement as typeof select).colorScheme,
      text: option.color,
      background: option.backgroundColor,
    }
  })
  // Native controls follow the theme, and options carry their own colours
  // instead of the page's light text on the browser's white list.
  expect(colours.scheme).toBe('dark')
  expect(colours.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(colours.text).not.toBe(colours.background)
})

// Eli logs in a logbook the test creates (and deletes) and in Eli's Personal
// logbook, which is emptied afterwards. Runs once rather than per device.
test.describe('logging', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.beforeEach(({ isMobile }) => {
    test.skip(isMobile, 'runs on desktop only')
  })
  // Only where the test ran: Playwright runs afterEach for skipped tests too.
  test.afterEach(async ({ isMobile }) => {
    if (isMobile) return
    await deleteOwnedGroups(users.eli.email)
    await clearDefaultGroup(users.eli.email)
  })

  async function addSuggestedMetrics(page: Page, names: string[]) {
    await openLogbookOption(page, 'Metrics')
    for (const name of names) {
      await page.getByRole('button', { name }).click()
      await expect(
        page.getByRole('list', { name: 'Metrics' }).getByText(name),
      ).toBeVisible()
    }
    await page.getByRole('main').getByRole('link').first().click() // back
  }

  test('entries are logged, edited and deleted through the same form everywhere', async ({
    page,
  }) => {
    const logEntry = page.getByRole('complementary').getByRole('button', {
      name: 'Log entry',
    })
    const sheet = page.getByRole('dialog', { name: 'Log entry' })
    const entries = page.getByRole('list', { name: 'Recent entries' })

    await logIn(page, users.eli.email)

    // Nowhere to log yet: no logbook has metrics.
    await logEntry.click()
    await expect(sheet.getByText("There's nowhere to log yet.")).toBeVisible()
    await page.keyboard.press('Escape')

    // A logbook with a participant and two metrics
    await page.getByRole('link', { name: 'New logbook' }).click()
    await page.getByLabel('Name').fill('Eli Log')
    await page.getByRole('button', { name: 'Create logbook' }).click()
    await openLogbookOption(page, 'Participants')
    await page.getByRole('link', { name: 'Add participant' }).click()
    await page.getByLabel('Name').fill('Bea')
    await page.getByRole('button', { name: 'Add participant' }).click()
    await page.getByRole('main').getByRole('link', { name: 'Eli Log' }).click()
    await addSuggestedMetrics(page, ['Weight (kg)', 'Waist (cm)'])
    await expect(
      page.getByRole('region', { name: 'Recent entries' }),
    ).toContainText('Nothing logged yet.')

    // From the logbook: it's preselected, with its participant.
    await logEntry.click()
    await expect(sheet.getByLabel('Logbook')).toHaveValue(/.+/)
    await expect(
      sheet.getByLabel('Logbook').locator('option:checked'),
    ).toHaveText('Eli Log')
    await expect(
      sheet.getByLabel('Participant').locator('option:checked'),
    ).toHaveText('Bea')
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet.getByText('Enter at least one value.')).toBeVisible()
    await sheet.getByLabel('Weight (kg)').fill('72,45')
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet.getByText('Use at most 1 decimal.')).toBeVisible()
    await sheet.getByLabel('Weight (kg)').fill('72,4')
    await sheet.getByLabel('Waist (cm)').fill('81')
    await sheet.getByLabel('Comment (optional)').fill('After a run')
    // A wrong date is explained. Then a fixed time, so the duplicate check
    // below doesn't depend on the clock.
    await sheet
      .getByRole('group', { name: 'When' })
      .getByLabel('Date', { exact: true })
      .fill('31/02/2026')
    await sheet.getByRole('button', { name: 'Save 2 values' }).click()
    await expect(
      sheet.getByText('Enter the date as dd/mm/yyyy and the time as hh:mm.'),
    ).toBeVisible()
    await fillYesterdayAt(sheet, '08:00')
    await sheet.getByRole('button', { name: 'Save 2 values' }).click()

    await expect(sheet).toHaveCount(0)
    await expect(entries.getByRole('listitem')).toHaveCount(2)
    await expect(entries).toContainText('72.4 kg')
    await expect(entries).toContainText('81.0 cm')
    await expect(entries).toContainText('After a run')

    // The same moment twice is refused; an earlier time is fine.
    await logEntry.click()
    await sheet.getByLabel('Weight (kg)').fill('72')
    await fillYesterdayAt(sheet, '08:00')
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(
      sheet.getByText('There is already an entry for this participant'),
    ).toBeVisible()
    await fillYesterdayAt(sheet, '7:00')
    await sheet.getByRole('button', { name: 'Save' }).click()
    await expect(sheet).toHaveCount(0)
    await expect(entries.getByRole('listitem')).toHaveCount(3)

    // From elsewhere: starts in the last logbook used.
    await page
      .getByRole('navigation', { name: 'Main' })
      .getByRole('link', { name: 'Profile' })
      .click()
    await logEntry.click()
    await expect(
      sheet.getByLabel('Logbook').locator('option:checked'),
    ).toHaveText('Eli Log')
    await page.keyboard.press('Escape')

    // Switching logbook with values typed in asks first.
    await page.goto('/logbooks')
    await page.getByRole('link', { name: /^Personal/ }).click()
    await addSuggestedMetrics(page, ['Height (cm)'])
    await page.goto('/logbooks')
    await logEntry.click()
    await sheet.getByLabel('Weight (kg)').fill('71')
    await sheet.getByLabel('Logbook').selectOption({ label: 'Personal' })
    await expect(sheet.getByText('will be discarded')).toBeVisible()
    await sheet.getByRole('button', { name: 'Keep editing' }).click()
    await expect(sheet.getByLabel('Weight (kg)')).toHaveValue('71')
    await sheet.getByLabel('Logbook').selectOption({ label: 'Personal' })
    await sheet.getByRole('button', { name: 'Switch and discard' }).click()
    await expect(sheet.getByLabel('Height (cm)')).toBeVisible()
    await expect(
      sheet.getByLabel('Participant').locator('option:checked'),
    ).toHaveText('Eli Example (you)')
    await page.keyboard.press('Escape')

    // Edit and delete
    await page.goto('/logbooks')
    await page.getByRole('link', { name: /^Eli Log/ }).click()
    await entries.getByRole('link', { name: /^Edit Waist of Bea/ }).click()
    await expect(page.getByText(/Logged by Eli Example on/)).toBeVisible()
    await page.getByLabel('Waist (cm)').fill('80.5')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(entries).toContainText('80.5 cm')

    await entries.getByRole('link', { name: /^Edit Waist of Bea/ }).click()
    await expect(page.getByText(/Last changed by Eli Example on/)).toBeVisible()
    await page.getByRole('button', { name: 'Delete entry…' }).click()
    await page.getByRole('button', { name: 'Delete for good' }).click()
    await expect(entries.getByRole('listitem')).toHaveCount(2)

    // Metrics with entries warn before their unit changes.
    await openLogbookOption(page, 'Metrics')
    await page.getByRole('link', { name: 'Edit Weight' }).click()
    await page.getByLabel('Unit (optional)').fill('lb')
    await expect(
      page.getByText('2 entries have already been logged.'),
    ).toBeVisible()
  })
})

test('all entries can be filtered, sorted and paged', async ({
  page,
  isMobile,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000001') // Kids
  await page
    .getByRole('link', { name: 'All entries, with filters and sorting' })
    .click()
  await expect(page.getByRole('heading', { name: 'All entries' })).toBeVisible()

  // 13 months × 2 children × 2 metrics, 50 per page.
  await expect(page.getByRole('status')).toHaveText('52 entries')
  // A table on wide screens, a list on phones; one item per entry either way.
  const rows = isMobile
    ? page.getByRole('list', { name: 'Entries' }).getByRole('listitem')
    : page
        .getByRole('table')
        .getByRole('row')
        .filter({ has: page.locator('td') })
  await expect(rows).toHaveCount(50)
  await expect(page.getByText('Page 1 of 2')).toBeVisible()
  await page.getByRole('button', { name: 'Older' }).click()
  await expect(rows).toHaveCount(2)

  // Value order needs one metric: values of different metrics don't compare.
  await expect(
    page
      .getByLabel('Order', { exact: true })
      .locator('option[value="highest"]'),
  ).toBeDisabled()
  await page
    .getByLabel('Participant', { exact: true })
    .selectOption({ label: 'Mia' })
  await page
    .getByLabel('Metric', { exact: true })
    .selectOption({ label: 'Height (cm)' })
  await expect(page.getByRole('status')).toHaveText('13 entries')
  await expect(page.getByText('Page 1 of 2')).toHaveCount(0)

  await page.getByLabel('Order', { exact: true }).selectOption('highest')
  await expect(rows.first()).toContainText(/12\d\.\d cm/)
  const values = await rows.allInnerTexts()
  const numbers = values.map((v) =>
    Number.parseFloat(v.match(/(\d+\.\d) cm/)![1]),
  )
  expect(numbers).toEqual([...numbers].sort((a, b) => b - a))
})
