import { expect, type Page } from '@playwright/test'

import { SEED_PASSWORD } from './local-supabase'

export async function logIn(
  page: Page,
  email: string,
  password = SEED_PASSWORD,
) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Logbooks' })).toBeVisible()
}

// Opens one of the logbook's management pages through its Options menu.
export async function openLogbookOption(
  page: Page,
  option:
    | 'Participants'
    | 'Metrics'
    | 'Members'
    | 'Invite people'
    | 'Privacy'
    | 'Edit logbook'
    | 'Export CSV',
) {
  await page.getByRole('button', { name: 'Options' }).click()
  await page.getByRole('menuitem', { name: option }).click()
}
