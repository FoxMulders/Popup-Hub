import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'

const certPath = path.join(__dirname, '.cert', 'localhost.pem')
const localHttpsAvailable = fs.existsSync(certPath)
const useHttps =
  process.env.PLAYWRIGHT_USE_HTTPS === '1' ||
  (process.env.PLAYWRIGHT_USE_HTTPS !== '0' && localHttpsAvailable)

const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ??
  (useHttps ? 'https://localhost:3000' : 'http://localhost:3000')

const devCommand = useHttps ? 'npm run dev:https' : 'npm run dev'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'workflow',
      testMatch: /workflow\/.*\.spec\.ts/,
      fullyParallel: false,
      workers: 1,
      timeout: 120_000,
      grep: /@workflow/,
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    {
      name: 'desktop-edge',
      testIgnore: /workflow\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    {
      name: 'ios-webkit',
      testIgnore: /workflow\/.*\.spec\.ts/,
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'android-chromium',
      testIgnore: /workflow\/.*\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: devCommand,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        ignoreHTTPSErrors: true,
        timeout: 120_000,
      },
})
