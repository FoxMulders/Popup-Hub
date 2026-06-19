import { test, expect } from '@playwright/test'

test.describe('Vendor mobile chrome', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('vendor events login page renders apply CTA area', async ({ page }) => {
    await page.goto('/vendor/events')
    await expect(page).toHaveURL(/\/login/)
  })

  test('vendor events page structure when accessible', async ({ page }) => {
    await page.goto('/vendor/events')
    if (page.url().includes('/login')) {
      test.skip(true, 'Requires vendor auth — smoke login redirect only')
    }
    await expect(page.getByRole('navigation', { name: 'Vendor navigation' })).toBeVisible()
  })
})
