import { test as base, expect, type Page } from '@playwright/test'

export type DevMockRole = 'coordinator' | 'vendor' | 'shopper'

const REAL_LOGIN = process.env.PLAYWRIGHT_REAL_LOGIN === '1'

const REAL_CREDENTIALS: Record<DevMockRole, { email?: string; password?: string }> = {
  coordinator: {
    email: process.env.DEV_MOCK_COORDINATOR_EMAIL ?? 'coordinator@me.com',
    password: process.env.DEV_MOCK_COORDINATOR_PASSWORD ?? 'testing',
  },
  vendor: {
    email: process.env.DEV_MOCK_VENDOR_EMAIL ?? 'vendor@me.com',
    password: process.env.DEV_MOCK_VENDOR_PASSWORD ?? 'testing',
  },
  shopper: {
    email: process.env.DEV_MOCK_SHOPPER_EMAIL ?? 'patron@me.com',
    password: process.env.DEV_MOCK_SHOPPER_PASSWORD ?? 'testing',
  },
}

const LANDING_PATH: Record<DevMockRole, string | RegExp> = {
  coordinator: /\/coordinator/,
  vendor: /\/vendor/,
  shopper: /\/discover/,
}

async function loginViaPassword(page: Page, role: DevMockRole) {
  const { email, password } = REAL_CREDENTIALS[role]
  if (!email || !password) {
    throw new Error(`Missing credentials for ${role} — set DEV_MOCK_* env vars`)
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(LANDING_PATH[role], { timeout: 20_000 })
}

export async function loginAsCoordinator(page: Page) {
  if (REAL_LOGIN) {
    await loginViaPassword(page, 'coordinator')
    await page.goto('/coordinator/studio')
    await expect(page).toHaveURL(/\/coordinator/)
    return
  }

  const response = await page.goto('/api/dev/mock-login?role=coordinator')
  expect(response?.ok() ?? true).toBeTruthy()
  await expect(page).toHaveURL(/\/coordinator/, { timeout: 20_000 })
}

export async function loginAsVendor(page: Page) {
  if (REAL_LOGIN) {
    await loginViaPassword(page, 'vendor')
    return
  }

  const response = await page.goto('/api/dev/mock-login?role=vendor')
  expect(response?.ok() ?? true).toBeTruthy()
  await expect(page).toHaveURL(/\/vendor/)
}

export async function loginAsPatron(page: Page) {
  if (REAL_LOGIN) {
    await loginViaPassword(page, 'shopper')
    return
  }

  const response = await page.goto('/api/dev/mock-login?role=shopper')
  expect(response?.ok() ?? true).toBeTruthy()
  await expect(page).toHaveURL(/\/discover/)
}

export const test = base.extend({
  coordinatorPage: async ({ page }, use) => {
    await loginAsCoordinator(page)
    await use(page)
  },
  vendorPage: async ({ page }, use) => {
    await loginAsVendor(page)
    await use(page)
  },
  patronPage: async ({ page }, use) => {
    await loginAsPatron(page)
    await use(page)
  },
})

export { expect }
