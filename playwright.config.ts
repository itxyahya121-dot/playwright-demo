import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'https://b2b.dunyaaviation.com/',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  timeout: 120000,

  projects: [
    {
      // Login once and save session
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    {
      // Main test suite
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    {
      // Development project (no setup dependency)
      name: 'dev',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
