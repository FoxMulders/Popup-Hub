import { test, expect } from '@playwright/test'
import { HOME_HERO } from '../../lib/marketing/home-hero'
import { TRUST_DIRECTORY_LINKS } from '../../lib/nav/trust-directory-nav'

const smokeEventId =
  process.env.PLAYWRIGHT_SMOKE_EVENT_ID ?? '4e87e086-da8e-4e46-af11-b1e7322f4e65'

test.describe('Public discovery and routing smoke', () => {
  test('landing and discover pages load', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('heading', { level: 1, name: HOME_HERO.headline })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Start hosting a market' }).first()
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: TRUST_DIRECTORY_LINKS.check.ctaOpen }).first()
    ).toBeVisible()

    await page.goto('/discover')
    await expect(
      page.getByRole('heading', { name: 'Community markets near you' })
    ).toBeVisible({ timeout: 15_000 })
  })

  test('legacy shopper event URL redirects to public event page', async ({ page }) => {
    await page.goto(`/shopper/events/${smokeEventId}`)
    await expect(page).toHaveURL(new RegExp(`/events/${smokeEventId}`))
  })

  test('login page renders without hydration error banner', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
    await expect(page.getByText(/hydration failed/i)).toHaveCount(0)
    await expect(page.getByText(/text content did not match/i)).toHaveCount(0)
  })
})
