import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.test' });

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    navigationTimeout: 60_000,
    // Fresh context per test — no leftover cookies, storage, or autofill
    storageState: undefined,
    launchOptions: {
      args: [
        // Disable Chrome's password manager, autofill, and credential warnings
        '--disable-features=PasswordManager,AutofillServerCommunication',
        '--disable-save-password-bubble',
        '--disable-component-extensions-with-background-pages',
        '--no-default-browser-check',
        '--disable-infobars',
        '--disable-popup-blocking',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: process.env.TEST_BASE_URL || 'http://localhost:5174',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
