'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'

const ERROR_MESSAGES: Record<string, string> = {
  error_not_configured:
    'Google OAuth is not configured on this server. Ask your platform admin to set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.',
  error_missing_code: 'Google sign-in did not return an authorization code. Try connecting again.',
  error_session_mismatch: 'Your session changed during Google sign-in. Sign in again and retry.',
  error_forbidden: 'Only coordinator accounts can connect Google Docs.',
  error_token_exchange_failed: 'Google could not complete the connection. Try again in a moment.',
  error_access_denied: 'Google access was denied. You can close this and try again later.',
}

export function GoogleOAuthReturnAlert() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const oauthParam = searchParams.get('google_oauth')
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (oauthParam === 'connected') {
      toast.success('Google account connected — you can import from Docs.')
      const url = new URL(window.location.href)
      url.searchParams.delete('google_oauth')
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false })
      setDismissed(true)
    }
  }, [oauthParam, router])

  function dismissParam() {
    const url = new URL(window.location.href)
    url.searchParams.delete('google_oauth')
    router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false })
    setDismissed(true)
  }

  if (!oauthParam || dismissed) return null
  if (oauthParam === 'connected') return null

  const message =
    ERROR_MESSAGES[oauthParam] ??
    'Google Docs connection failed. Close this message and try again when ready.'

  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">Google Docs connection</p>
        <p className="text-red-800/90">{message}</p>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={dismissParam}>
          Close
        </Button>
      </div>
      <button
        type="button"
        onClick={dismissParam}
        className="shrink-0 rounded-md p-1 text-red-700 hover:bg-red-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
