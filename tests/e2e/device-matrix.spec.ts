import { test, expect } from './helpers/coordinator-auth'

const smokeEventName = process.env.PLAYWRIGHT_SMOKE_EVENT_NAME ?? 'Market Test 3'

test.describe('Popup Hub Multi-Platform Rendering Verification', () => {
  test('validate dashboard core frame components', async ({ coordinatorPage: page }) => {
    await page.goto('/coordinator/dashboard')

    const mainHeader = page.getByRole('heading', { name: 'Coordinator Dashboard', level: 1 })
    await expect(mainHeader).toBeVisible()

    const stripeConnect = page.getByRole('link', { name: /Connect Payouts \(Stripe\)/ }).first()
    const stripeActive = page.getByText('Payout Account Active (Stripe Connected)').first()
    await expect(stripeConnect.or(stripeActive)).toBeVisible()

    const myEventsHeading = page.getByRole('heading', { name: 'My Events', level: 2 })
    await expect(myEventsHeading).toBeVisible()

    const activeMarketCard = page.locator(`h3:has-text("${smokeEventName}")`)
    const anyEventCard = page.locator('.grid h3').first()
    await expect(activeMarketCard.or(anyEventCard)).toBeVisible()
  })
})
