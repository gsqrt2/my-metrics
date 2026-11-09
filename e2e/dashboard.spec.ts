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
