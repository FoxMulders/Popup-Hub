'use client'

import { useSearchParams } from 'next/navigation'
import { AlertCircle, CheckCircle } from 'lucide-react'

const ERROR_COPY: Record<string, string> = {
  missing_redirect:
    'App URL is not configured. Set NEXT_PUBLIC_APP_URL to your deployment origin (no trailing slash).',
  invalid_client_id:
    'Square could not find that Application ID. Use the Sandbox Application ID when SQUARE_ENVIRONMENT is not production, and ensure NEXT_PUBLIC_SQUARE_APP_ID (or SQUARE_CLIENT_ID) matches the Square Developer Dashboard.',
  missing_app_id:
    'Square Application ID is not configured. Set NEXT_PUBLIC_SQUARE_APP_ID in your environment and restart the server.',
  missing_app_secret:
    'Square application secret is missing. Set SQUARE_APPLICATION_SECRET (or SQUARE_CLIENT_SECRET) for OAuth token exchange.',
  oauth_failed: 'Square authorization failed. Try connecting again or check your Square app credentials.',
  session_mismatch: 'Your session changed during Square login. Sign in again and retry Connect Square.',
  forbidden: 'Only coordinator accounts can connect Square for payouts.',
  missing_access_token:
    'No SQUARE_ACCESS_TOKEN in .env.local. Copy a Sandbox seller access token from the Square Developer Console.',
  invalid_access_token:
    'Square rejected SQUARE_ACCESS_TOKEN. Copy a fresh Sandbox access token for your seller test account, update .env.local, restart npm run dev, and try the dev connect button again.',
  no_merchant: 'Could not resolve a Square merchant ID from the sandbox access token.',
  dev_token_failed: 'Dev sandbox connect failed. Check SQUARE_ACCESS_TOKEN and restart the dev server.',
}

export function SquareConnectAlerts() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success') === 'true'
  const error = searchParams.get('error')
  const detail = searchParams.get('detail')

  if (!success && !error) return null

  if (success) {
    return (
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sage-200 bg-sage-50 p-3 text-sm text-sage-900">
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" aria-hidden />
        <p>Square connected successfully. Booth payments can now flow to your Square account.</p>
      </div>
    )
  }

  const message = (error && ERROR_COPY[error]) || ERROR_COPY.oauth_failed

  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-lg border border-terracotta-200 bg-terracotta-50 p-3 text-sm text-terracotta-900"
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">{message}</p>
        {detail ? <p className="text-xs text-terracotta-800/90">{detail}</p> : null}
        {error === 'invalid_client_id' ? (
          <p className="text-xs text-terracotta-800/90">
            Register redirect URI{' '}
            <code className="rounded bg-white/60 px-1 py-0.5 text-[11px]">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/api/square/oauth/callback`
                : '{APP_URL}/api/square/oauth/callback'}
            </code>{' '}
            in the Square Developer Dashboard under OAuth.
          </p>
        ) : null}
      </div>
    </div>
  )
}
