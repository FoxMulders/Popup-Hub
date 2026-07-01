import { test, expect } from '@playwright/test'

const smokeEventId =
  process.env.PLAYWRIGHT_SMOKE_EVENT_ID ?? '4e87e086-da8e-4e46-af11-b1e7322f4e65'

test.describe('Patron mobile chrome', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('discover shows shopper bottom nav on mobile viewport', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('navigation', { name: 'Shopper navigation' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Discover' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Favorites' })).toBeVisible()
  })

  test('shopper bottom nav stays pinned to viewport bottom while scrolled', async ({ page }) => {
    await page.goto('/discover')
    const nav = page.getByRole('navigation', { name: 'Shopper navigation' })
    await expect(nav).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, 800))
    await page.waitForTimeout(200)

    const pinned = await nav.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      return {
        parentIsBody: el.parentElement === document.body,
        atViewportBottom: Math.abs(rect.bottom - window.innerHeight) < 2,
      }
    })

    expect(pinned.parentIsBody).toBe(true)
    expect(pinned.atViewportBottom).toBe(true)
  })

  test('discover home hides back bar', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  })

  test('event detail keeps sticky back bar while scrolled', async ({ page }) => {
    await page.goto(`/events/${smokeEventId}`)
    const back = page.getByRole('button', { name: 'Back' })
    await expect(back).toBeVisible()

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect(back).toBeVisible()

    const sticky = await page.locator('.page-back-bar').evaluate((node) => {
      const style = window.getComputedStyle(node)
      return style.position === 'sticky'
    })
    expect(sticky).toBe(true)
  })

  test('event map opts out of swipe-back on floorplan host', async ({ page }) => {
    await page.goto(`/events/${smokeEventId}/map`)
    await expect(page.locator('[data-swipe-back="off"]')).toHaveCount(1)
  })
})
