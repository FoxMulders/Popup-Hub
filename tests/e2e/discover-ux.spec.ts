import { test, expect } from '@playwright/test'

test.describe('Discover UX @prod-smoke', () => {
  test('discover shows address filter and map/list toggle', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Community markets near you' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByPlaceholder(/address|postal code/i)).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'List' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Map' })).toBeVisible()
  })

  test('Use my location switches to map view', async ({ page, context }) => {
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 53.5461, longitude: -113.4938 })
    await page.goto('/discover')
    await page.getByRole('button', { name: 'Use my location' }).click()
    await expect(page).toHaveURL(/view=map/)
  })

  test('view toggle preserves scroll position', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Community markets near you' })).toBeVisible({
      timeout: 15_000,
    })
    await page.evaluate(() => window.scrollTo(0, 600))
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(100)
    await page.getByRole('tab', { name: 'Map' }).click()
    await expect(page).toHaveURL(/view=map/)
    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(scrollAfter).toBeGreaterThan(100)
    await page.getByRole('tab', { name: 'Vendors' }).click()
    await expect(page).toHaveURL(/view=vendors/)
    const scrollAfterVendors = await page.evaluate(() => window.scrollY)
    expect(scrollAfterVendors).toBeGreaterThan(100)
  })

  test('footer exposes build metadata', async ({ page }) => {
    await page.goto('/discover')
    const buildMeta = page.getByTestId('build-version-footer')
    await expect(buildMeta).toBeAttached()
    await expect(buildMeta).toHaveAttribute('data-build-number', /.+/)
    await expect(buildMeta).toHaveAttribute('data-build-commit', /.+/)
  })

  test('logo links to home', async ({ page }) => {
    await page.goto('/discover')
    await page.getByRole('link', { name: 'Popup Hub' }).click()
    await expect(page).toHaveURL('/')
  })
})

test.describe('Discover UX mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('compact header with menu on mobile', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Community markets near you' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Open navigation menu/i })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Shopper navigation' })).toBeVisible()
  })
})
