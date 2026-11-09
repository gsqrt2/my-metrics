import { expect, test as setup } from '@playwright/test'

import { SEED_PASSWORD, users } from './support/local-supabase'

// Logs in once and saves the session for the tests that need a logged-in user
// (see storageState in playwright.config.ts).
setup('log in as Alex', async ({ page }) => {
  await page.goto('/login')
  await page.getByLabel('Email').fill(users.alex.email)
  await page.getByLabel('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page.getByRole('heading', { name: 'Logbooks' })).toBeVisible()
  await page.context().storageState({ path: 'e2e/.auth/alex.json' })
})
