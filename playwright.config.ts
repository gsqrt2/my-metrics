import { defineConfig, devices } from '@playwright/test'

const port = 5173
// Saved by e2e/auth.setup.ts.
const storageState = 'e2e/.auth/alex.json'

// Needs the local Supabase stack with seed data: `pnpm db:start` (see README).
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // In CI: annotations on the run, plus an HTML report that the workflow
  // uploads when tests fail.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState },
      dependencies: ['setup'],
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], storageState },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: `pnpm dev --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
  },
})
