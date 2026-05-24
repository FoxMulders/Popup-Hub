import { test, expect } from '@playwright/test'

test.describe('QA batch 1 — OAuth CSRF', () => {
  test('H2: Square callback rejects when state does not match session user', async ({ page }) => {
    await page.goto('/api/dev/mock-login?role=coordinator')
    await page.waitForURL(/\/coordinator\//)

    await page.goto(
      '/api/square/oauth/callback?code=fake-code&state=00000000-0000-4000-8000-000000000001'
    )

    await expect(page).toHaveURL(/square-connect\?error=session_mismatch/)
  })
})
