import { test, expect } from '@playwright/test'

test.describe('Patron mobile chrome', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('discover shows shopper bottom nav on mobile viewport', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('navigation', { name: 'Shopper navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Favorites' })).toBeVisible()
  })
})
