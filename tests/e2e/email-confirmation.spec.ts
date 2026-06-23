import { test, expect } from '@playwright/test'

test.describe('Email confirmation @auth', () => {
  test('confirm-email page loads with resend form', async ({ page }) => {
    await page.goto('/confirm-email?email=test@example.com')
    await expect(page.getByRole('heading', { name: 'Confirm your email' })).toBeVisible()
    await expect(page.getByLabel('Email')).toHaveValue('test@example.com')
    await expect(page.getByRole('button', { name: 'Resend confirmation link' })).toBeVisible()
  })

  test('unauthenticated vendor route redirects to login', async ({ page }) => {
    await page.goto('/vendor/events')
    await expect(page).toHaveURL(/\/login/)
  })
})
