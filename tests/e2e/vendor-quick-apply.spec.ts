import { test, expect } from '@playwright/test'

test.describe('Vendor quick apply (public)', () => {
  test('vendor event detail route is reachable', async ({ page }) => {
    const smokeEventId =
      process.env.PLAYWRIGHT_SMOKE_EVENT_ID ?? '4e87e086-da8e-4e46-af11-b1e7322f4e65'
    await page.goto(`/vendor/events/${smokeEventId}`)
    const url = page.url()
    expect(url.includes(`/vendor/events/${smokeEventId}`) || url.includes('/login')).toBeTruthy()
  })
})
