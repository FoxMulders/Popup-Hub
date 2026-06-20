import { test, expect } from '@playwright/test'
import { requireWorkflowFixtures, readWorkflowState } from './workflow-state'

const DISCOVER_HEADING = 'Community markets near you'

test.describe('Patron public discovery @workflow', () => {
  test('public event detail loads for workflow market', async ({ page }) => {
    const fixtures = requireWorkflowFixtures()
    const eventId = readWorkflowState().eventId ?? fixtures.draftEventId
    const eventName = readWorkflowState().eventName ?? fixtures.draftEventName

    await page.goto(`/events/${eventId}`)
    await expect(page.getByRole('heading', { name: eventName, level: 1 })).toBeVisible({
      timeout: 20_000,
    })
  })

  test('discover page loads', async ({ page }) => {
    await page.goto('/discover')
    await expect(page.getByRole('heading', { name: DISCOVER_HEADING })).toBeVisible({
      timeout: 15_000,
    })
  })
})
