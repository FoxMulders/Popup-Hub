import { test, expect } from '@playwright/test'

test.describe('Scroll preservation on same-page reload', () => {
  test('discover date filter keeps scroll position', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Community markets near you' })).toBeVisible({
      timeout: 15_000,
    })

    await page.evaluate(() => {
      window.scrollTo(0, 640)
    })
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(300)

    await page.getByRole('button', { name: 'Tomorrow' }).click()
    await expect(page).toHaveURL(/when=tomorrow/)

    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(scrollAfter).toBe(scrollBefore)
  })

  test('discover view toggle keeps scroll position', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: 'Community markets near you' })).toBeVisible({
      timeout: 15_000,
    })

    await page.evaluate(() => {
      window.scrollTo(0, 520)
    })
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(200)

    await page.getByRole('tab', { name: 'Map' }).click()
    await expect(page).toHaveURL(/view=map/)

    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(scrollAfter).toBe(scrollBefore)
  })

  test('vendor application filter keeps scroll position when authenticated', async ({ page }) => {
    await page.goto('/vendor/applications')
    if (page.url().includes('/login')) {
      test.skip(true, 'Requires vendor auth — login redirect only')
    }

    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible({ timeout: 15_000 })

    await page.evaluate(() => {
      window.scrollTo(0, 480)
    })
    const scrollBefore = await page.evaluate(() => window.scrollY)
    expect(scrollBefore).toBeGreaterThan(100)

    const pendingTab = page.getByRole('tab', { name: /Pending/i })
    if ((await pendingTab.count()) === 0) {
      test.skip(true, 'No application filter tabs available for this account')
    }

    await pendingTab.click()
    await expect(page).toHaveURL(/filter=pending/)

    const scrollAfter = await page.evaluate(() => window.scrollY)
    expect(scrollAfter).toBe(scrollBefore)
  })
})
