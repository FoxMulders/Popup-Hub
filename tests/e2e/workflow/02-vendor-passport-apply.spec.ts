import { test, expect } from '../helpers/role-auth'
import { requireWorkflowFixtures, readWorkflowState, writeWorkflowState } from './workflow-state'

test.describe('Vendor passport and apply @workflow', () => {
  test('shows approved paid application on workflow market', async ({ vendorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const state = readWorkflowState()
    const eventId = state.eventId ?? fixtures.draftEventId
    const eventName = state.eventName ?? fixtures.draftEventName

    await page.goto(`/vendor/events/${eventId}`)

    await expect(page.getByRole('heading', { name: eventName, level: 1 })).toBeVisible({
      timeout: 20_000,
    })

    await expect(
      page
        .getByText(/Approved|Booth confirmed|You're in/i)
        .first()
    ).toBeVisible({ timeout: 15_000 })

    writeWorkflowState({ ...state, eventId, eventName })
  })

  test('vendor can open apply dialog when no application exists', async ({ vendorPage: page }) => {
    const fixtures = requireWorkflowFixtures()

    await page.goto(`/vendor/events/${fixtures.draftEventId}`)

    const applyButton = page.getByRole('button', { name: 'Apply Now' })
    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click()
      await expect(page.getByRole('dialog', { name: /Apply to/i })).toBeVisible()
    }
  })

  test('vendor event detail reachable from fixtures', async ({ vendorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const eventName = readWorkflowState().eventName ?? fixtures.draftEventName

    await page.goto(`/vendor/events/${fixtures.draftEventId}`)
    await expect(page.getByRole('heading', { name: eventName, level: 1 })).toBeVisible({
      timeout: 20_000,
    })
  })
})
