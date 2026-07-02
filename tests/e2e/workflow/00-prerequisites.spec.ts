import { test, expect } from '../helpers/role-auth'
import { readWorkflowState, writeWorkflowState } from './workflow-state'

test.describe('Workflow prerequisites @workflow', () => {
  test('signup page shows all three roles', async ({ page }) => {
    await page.goto('/signup')
    await expect(page.getByText('Patron', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Vendor', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Coordinator', { exact: true }).first()).toBeVisible()
  })

  test('coordinator mock-login lands on coordinator portal', async ({ coordinatorPage: page }) => {
    await expect(page).toHaveURL(/\/coordinator/)
    await expect(page.locator('#site-app-nav').getByRole('link', { name: 'HubGrid' })).toBeVisible({
      timeout: 15_000,
    })
  })

  test('vendor mock-login lands on vendor portal', async ({ vendorPage: page }) => {
    await expect(page).toHaveURL(/\/vendor/)
    await page.goto('/vendor/passport')
    await expect(page.getByText(/Business Info/i).first()).toBeVisible({
      timeout: 15_000,
    })
  })

  test('patron mock-login lands on home', async ({ patronPage: page }) => {
    await expect(page).toHaveURL(/\/$/)
    await expect(
      page.getByRole('heading', { name: 'One hub for local makers markets' })
    ).toBeVisible({ timeout: 15_000 })
  })
})

test.describe('Workflow state carry-over @workflow', () => {
  test('initializes empty workflow state file', async () => {
    const state = readWorkflowState()
    expect(state).toBeDefined()
    writeWorkflowState({ ...state })
  })
})
