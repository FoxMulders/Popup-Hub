import { test, expect } from '../helpers/role-auth'
import { requireWorkflowFixtures, readWorkflowState, writeWorkflowState } from './workflow-state'

test.describe('Vendor passport and apply @workflow', () => {
  test('applies to published workflow market', async ({ vendorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const state = readWorkflowState()
    const eventId = state.eventId ?? fixtures.draftEventId
    const eventName = state.eventName ?? fixtures.draftEventName

    await page.goto(`/vendor/events/${eventId}`)

    await expect(page.getByRole('heading', { name: eventName, level: 1 })).toBeVisible({
      timeout: 20_000,
    })

    const applyButton = page.getByRole('button', { name: 'Apply Now' })
    const alreadyApplied = page.getByText(/Applied/i).first()

    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click()

      const contractCheckbox = page.getByRole('checkbox', {
        name: /digital booth contract/i,
      })
      if (await contractCheckbox.isVisible()) {
        await contractCheckbox.check()
      }

      await page.getByRole('button', { name: /Confirm & Submit Application/i }).click()
      await expect(alreadyApplied).toBeVisible({ timeout: 20_000 })
    } else {
      await expect(alreadyApplied).toBeVisible({ timeout: 10_000 })
    }

    writeWorkflowState({ ...state, eventId, eventName })
  })

  test('vendor events grid shows workflow market', async ({ vendorPage: page }) => {
    const fixtures = requireWorkflowFixtures()
    const eventName = readWorkflowState().eventName ?? fixtures.draftEventName

    await page.goto('/vendor/events')
    await expect(page.getByText(eventName)).toBeVisible({ timeout: 20_000 })
  })
})
