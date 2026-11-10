import { readFile } from 'node:fs/promises'

import { expect, test } from '@playwright/test'

import { openLogbookOption } from './support/login'

const BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`)

// FR-70: the CSV holds what the user sees. In the demo data Kim shows the
// others only the % change of her weight in Diet Challenge.
test('a logbook exports as CSV, with hidden values as % change only', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  const downloading = page.waitForEvent('download')
  await openLogbookOption(page, 'Export CSV')
  const download = await downloading

  expect(download.suggestedFilename()).toMatch(
    /^Diet Challenge entries \d{4}-\d{2}-\d{2}\.csv$/,
  )
  const lines = (await readFile(await download.path(), 'utf8'))
    .replace(BOM, '')
    .trim()
    .split('\r\n')
  expect(lines[0]).toBe(
    'Participant,Metric,Unit,Measured at,Value,Change since first entry (%),Contains,Comment,Logged by',
  )
  const kimsWeight = lines.filter((line) =>
    line.startsWith('Kim Example,Weight,'),
  )
  expect(kimsWeight.length).toBeGreaterThan(0)
  for (const line of kimsWeight) {
    expect(line).toMatch(
      /^Kim Example,Weight,kg,\d{4}-\d{2}-\d{2} \d{2}:\d{2},,-?[\d.]+,% change only,/,
    )
  }
  expect(
    lines.some((line) => /^Alex Example,Weight,kg,.+,\d+\.\d,/.test(line)),
  ).toBe(true)
  await expect(page.getByText(/^Exported \d+ entries\.$/)).toBeVisible()
})
