import { test, expect } from '../helpers/role-auth'
import { requireWorkflowFixtures, readWorkflowState } from './workflow-state'

test.describe('Coordinator approve @workflow', () => {
  test('reviews and approves vendor application when pending', async ({ coordinatorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const eventId = readWorkflowState().eventId ?? fixtures.draftEventId

    await page.goto(`/coordinator/events/${eventId}/applications`)

    const reviewButton = page.getByRole('button', { name: 'Review' }).first()
    await expect(reviewButton).toBeVisible({ timeout: 20_000 })
    await reviewButton.click()

    const approveButton = page.getByRole('button', { name: /Approve Application/i })
    if (await approveButton.isVisible().catch(() => false)) {
      await approveButton.click()
      await expect(page.getByText(/approved/i).first()).toBeVisible({ timeout: 20_000 })
    } else {
      await expect(page.getByText(/Approved/i).first()).toBeVisible({ timeout: 10_000 })
    }
  })

  test('event hub remains reachable after approval', async ({ coordinatorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const eventId = readWorkflowState().eventId ?? fixtures.draftEventId

    await page.goto(`/coordinator/events/${eventId}`)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('link', { name: /applications/i }).first()).toBeVisible()
  })
})
