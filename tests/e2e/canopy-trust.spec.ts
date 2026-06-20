import { test, expect } from '@playwright/test'
import { TRUST_DIRECTORY_LINKS } from '../../lib/nav/trust-directory-nav'

test.describe('HubGuard trust directory @prod-smoke', () => {
  test('/check loads without login and lists organizers', async ({ page }) => {
    await page.goto('/check')
    await expect(
      page.getByRole('heading', { name: TRUST_DIRECTORY_LINKS.check.boothFeeHeadline })
    ).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Organizers in our directory/i)).toBeVisible()

    const organizerLink = page
      .getByRole('link', { name: /Central Occasion|Agora Markets|Lauderdale/i })
      .first()
    const emptyState = page.getByText(/No organizers published yet/i)
    await expect(organizerLink.or(emptyState)).toBeVisible({ timeout: 15_000 })
  })

  test('organizer trust report loads when seeded', async ({ page }) => {
    const slug =
      process.env.PLAYWRIGHT_TRUST_ORGANIZER_SLUG ?? 'central-occasion-events'
    const response = await page.goto(`/organizers/${slug}`)
    if (!response || response.status() === 404) {
      test.skip(true, `Organizer /organizers/${slug} not available in this environment`)
    }
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15_000 })
  })

  test('guest /check/review shows sign-in gate', async ({ page }) => {
    await page.goto('/check/review')
    await expect(page.getByRole('heading', { name: 'Review an organizer' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(
      page.locator('#site-main').getByRole('link', { name: 'Sign in' })
    ).toBeVisible()
  })

  test('homepage nav links to HubGuard trust directory', async ({ page }) => {
    await page.goto('/')
    const navLabel = TRUST_DIRECTORY_LINKS.check.navLabel
    const viewport = page.viewportSize()
    if (viewport && viewport.width < 768) {
      await page.getByRole('button', { name: /Open navigation menu/i }).click()
    }
    await expect(page.getByRole('link', { name: navLabel }).first()).toBeVisible()
  })
})
