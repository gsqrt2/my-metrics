import { expect, test } from '@playwright/test'

test('a logbook leads with a chart per metric, filterable by participant', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge

  // FR-15: where the challenge stands today.
  await expect(page.getByText(/Day \d+ of 84/)).toBeVisible()

  // One chart per metric, in the metrics' order.
  const charts = page.getByRole('article')
  await expect(charts).toHaveCount(3)
  await expect(charts.getByRole('heading')).toHaveText([
    'Weight (kg)',
    'Waist (cm)',
    'Body fat (%)',
  ])

  // Every participant with weights is in the weight chart, with the latest
  // value and the changes, shown without judgement.
  const weight = page.getByRole('list', { name: 'Weight: latest values' })
  await expect(weight.getByRole('listitem')).toHaveCount(3)
  await expect(weight.getByRole('listitem').first()).toContainText(
    /Alex Example\s*\d+\.\d kg.*since last.*since first/,
  )

  // The participant chips filter every chart.
  const participants = page.getByRole('list', { name: 'Participants' })
  // ...and look clickable.
  await expect(
    participants.getByRole('button', { name: /Kim Example/ }),
  ).toHaveCSS('cursor', 'pointer')
  await participants.getByRole('button', { name: /Kim Example/ }).click()
  await expect(weight.getByRole('listitem')).toHaveText([/^Kim Example/])
  await expect(
    page.getByRole('list', { name: 'Waist: latest values' }),
  ).toHaveCount(0)
  await participants.getByRole('button', { name: /Lee Example/ }).click()
  await expect(weight.getByRole('listitem')).toHaveCount(2)

  await page.getByRole('button', { name: 'Show all' }).click()
  await expect(weight.getByRole('listitem')).toHaveCount(3)
})

test('the by-participant view shows each person with every metric as % change', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  await page.getByRole('button', { name: 'By participant' }).click()

  const charts = page.getByRole('article')
  await expect(charts.getByRole('heading')).toHaveText([
    /Alex Example/,
    /Kim Example/,
    /Lee Example/,
  ])
  const alex = page.getByRole('list', { name: 'Alex Example: latest values' })
  await expect(alex.getByRole('listitem')).toHaveText([
    /^Weight\s*\d+\.\d kg\s*[−-]\d+(\.\d)?% since first/,
    /^Waist\s*\d+ cm\s*[−-]\d+(\.\d)?% since first/,
  ])

  // The metric chips filter now; the participant chips are plain.
  const metrics = page.getByRole('list', { name: 'Metrics' })
  await metrics.getByRole('button', { name: /Waist/ }).click()
  await expect(alex.getByRole('listitem')).toHaveText([/^Waist/])
  await expect(
    page.getByRole('list', { name: 'Participants' }).getByRole('button'),
  ).toHaveCount(0)

  // The view is remembered for this logbook.
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'By participant' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'By metric' }).click()
})

test('only the expand button opens a chart full screen', async ({ page }) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  await page.getByRole('img', { name: /^Weight over time/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Open Weight (kg) full screen' })
    .click()
  await expect(page.getByRole('dialog', { name: 'Weight (kg)' })).toBeVisible()
})

test('a chart opens full screen with time spans, y-axis and age options', async ({
  page,
}) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  await page
    .getByRole('button', { name: 'Open Weight (kg) full screen' })
    .click()

  const full = page.getByRole('dialog', { name: 'Weight (kg)' })
  const span = full.getByRole('group', { name: 'Time span' })
  // Everything by default; there's no "Duration" span.
  await expect(span.getByRole('button', { name: 'All' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(span.getByRole('button', { name: 'Duration' })).toHaveCount(0)
  await expect(
    full.getByRole('img', { name: /Weight over time/ }),
  ).toBeVisible()
  await span.getByRole('button', { name: 'Week' }).click()
  await expect(span.getByRole('button', { name: 'Week' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // Value, change or % change; the baseline choice comes with the changes.
  const show = full.getByRole('group', { name: 'Show' })
  await expect(full.getByRole('group', { name: 'Baseline' })).toHaveCount(0)
  await show.getByRole('button', { name: '% change' }).click()
  await expect(full.getByRole('group', { name: 'Baseline' })).toBeVisible()
  // No birthdates in the diet group, so no age axis.
  await expect(full.getByRole('group', { name: 'X-axis' })).toHaveCount(0)

  // The same participant filter as on the page.
  await full.getByRole('button', { name: /Kim Example/ }).click()
  await expect(
    full.getByRole('list', { name: 'Legend' }).getByRole('listitem'),
  ).toHaveText(['Kim Example'])
  await page.keyboard.press('Escape')
  await expect(full).toHaveCount(0)
  await page.getByRole('button', { name: 'Show all' }).click()
})

test('children can be compared by age', async ({ page }) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000001') // Kids
  await page
    .getByRole('button', { name: 'Open Height (cm) full screen' })
    .click()
  const full = page.getByRole('dialog', { name: 'Height (cm)' })
  // No duration: everything by default.
  await expect(
    full
      .getByRole('group', { name: 'Time span' })
      .getByRole('button', { name: 'All' }),
  ).toHaveAttribute('aria-pressed', 'true')
  await full
    .getByRole('group', { name: 'X-axis' })
    .getByRole('button', { name: 'Age' })
    .click()
  await expect(full.getByRole('img', { name: /Height over age/ })).toBeVisible()
  await expect(full.getByText(/^\d+ yrs?$/).first()).toBeVisible()
})

test("a participant's chart opens full screen too", async ({ page }) => {
  await page.goto('/logbooks/b0000000-0000-0000-0000-000000000002') // Diet Challenge
  await page.getByRole('button', { name: 'By participant' }).click()
  await page
    .getByRole('button', { name: 'Open Kim Example full screen' })
    .click()
  const full = page.getByRole('dialog', { name: 'Kim Example' })
  await expect(
    full.getByRole('list', { name: 'Legend' }).getByRole('listitem'),
  ).toHaveText(['Weight (kg)', 'Waist (cm)', 'Body fat (%)'])
  await expect(full.getByRole('group', { name: 'Baseline' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'By metric' }).click()
})
