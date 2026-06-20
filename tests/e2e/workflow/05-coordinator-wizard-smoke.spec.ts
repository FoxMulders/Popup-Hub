import { test, expect } from '../helpers/role-auth'

test.describe('Coordinator wizard smoke @workflow', () => {
  test('new market wizard step 1 loads with autosave shell', async ({ coordinatorPage: page }) => {
    await page.goto('/coordinator/events/new')

    await expect(page.getByLabel('Event name *')).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByLabel(/Description/i).first()).toBeVisible()
    await expect(
      page.getByRole('button', { name: /Proceed to Capacity Settings/i })
    ).toBeVisible()
  })

  test('coordinator markets list reachable from portal', async ({ coordinatorPage: page }) => {
    await page.goto('/coordinator/markets')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
  })
})
