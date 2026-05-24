import { test as base, expect } from '@playwright/test'

async function loginAsCoordinator(page: import('@playwright/test').Page) {
  const response = await page.goto('/api/dev/mock-login?role=coordinator')
  expect(response?.ok() ?? true).toBeTruthy()

  // Mock login may redirect to an event detail page; always land on the dashboard.
  await page.goto('/coordinator/dashboard')
  await expect(page).toHaveURL(/\/coordinator\/dashboard/)
}

export const test = base.extend({
  coordinatorPage: async ({ page }, use) => {
    await loginAsCoordinator(page)
    await use(page)
  },
})

export { expect }
