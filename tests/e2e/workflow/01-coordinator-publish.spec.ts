import { test, expect } from '../helpers/role-auth'
import { requireWorkflowFixtures, readWorkflowState, writeWorkflowState } from './workflow-state'

test.describe('Coordinator publish @workflow', () => {
  test('verifies seeded published market on event hub', async ({ coordinatorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const state = readWorkflowState()

    await page.goto(`/coordinator/events/${fixtures.draftEventId}`)

    await expect(page.getByRole('heading', { name: fixtures.draftEventName, level: 1 })).toBeVisible({
      timeout: 30_000,
    })

    writeWorkflowState({
      ...state,
      eventId: fixtures.draftEventId,
      eventName: fixtures.draftEventName,
    })
  })

  test('coordinator can open capacity step for workflow market', async ({ coordinatorPage: page }) => {
    const fixtures = requireWorkflowFixtures()

    await page.goto(`/coordinator/events/${fixtures.draftEventId}/setup?step=3`)

    await expect(page.getByText(/Step 2 of 2|Capacity/i).first()).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole('button', { name: 'Save market' })).toBeVisible()
  })
})
