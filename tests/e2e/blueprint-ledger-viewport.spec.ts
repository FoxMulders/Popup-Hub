import { expect, test } from '@playwright/test'
import { FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING } from '@/components/coordinator/dashboard/dashboard-ledger-viewport-guard'

test.describe('Blueprint Studio booth matrix viewport guard', () => {
  test('shows the regression warning instead of the matrix on pocket-sized viewports', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/coordinator/studio/ledger?screen=presenter')

    await expect(
      page.getByTestId('floor-plan-matrix-small-screen-warning')
    ).toContainText(FLOOR_PLAN_MATRIX_SMALL_SCREEN_WARNING)
    await expect(page.getByRole('heading', { name: 'Booth Matrix — Presenter' })).toHaveCount(0)
  })

  test('renders the presenter matrix on desktop-sized viewports', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.goto('/coordinator/studio/ledger?screen=presenter')

    await expect(
      page.getByTestId('floor-plan-matrix-small-screen-warning')
    ).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Booth Matrix — Presenter' })).toBeVisible()
  })
})
