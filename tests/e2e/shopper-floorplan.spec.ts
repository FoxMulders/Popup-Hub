import { test, expect } from '@playwright/test'

const smokeEventId =
  process.env.PLAYWRIGHT_SMOKE_EVENT_ID ?? '4e87e086-da8e-4e46-af11-b1e7322f4e65'

test.describe('Shopper floor plan routing', () => {
  test('map page renders routing controls and patron flow overlay', async ({ page }) => {
    await page.goto(`/events/${smokeEventId}/map`)

    await expect(page.getByRole('heading', { name: 'Floor plan' })).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Show patron flow' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Patron flow' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Direct to vendor' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Browse all' })).toBeVisible()

    await page.getByRole('tab', { name: 'Patron flow' }).click()
    await expect(page.getByRole('switch', { name: 'Show patron flow' })).toBeChecked()
    await expect(page.getByText('Calculating route…')).toBeHidden({ timeout: 15_000 })
    await expect(page.getByRole('img', { name: 'Patron route overlay' })).toBeVisible({
      timeout: 15_000,
    })

    await page.getByRole('tab', { name: 'Browse all' }).click()
    const patronSwitch = page.getByRole('switch', { name: 'Show patron flow' })
    if (await patronSwitch.isEnabled()) {
      await expect(page.getByText('Calculating route…')).toBeHidden({ timeout: 30_000 })
      await expect(page.getByRole('img', { name: 'Patron route overlay' })).toBeVisible({
        timeout: 15_000,
      })
    }

    const booth = page.getByRole('button', { name: /Booth \d+/i }).first()
    if (await booth.isVisible()) {
      await page.getByRole('tab', { name: 'Direct to vendor' }).click()
      await booth.click()
      await expect(page.getByText('Calculating route…')).toBeHidden({ timeout: 15_000 })
      await expect(page.getByRole('img', { name: 'Patron route overlay' })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.getByText(/shortest aisle route/i)).toBeVisible()
    }
  })

  test('event detail embeds venue map section', async ({ page }) => {
    await page.goto(`/events/${smokeEventId}`)

    await expect(page.getByRole('heading', { name: 'Venue map' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('switch', { name: 'Show patron flow' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Floor plan/i })).toBeVisible()
  })
})
