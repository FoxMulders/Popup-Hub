'use client'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { HelpCircle, ExternalLink } from 'lucide-react'

function isValidSquareOAuthUrl(oauthUrl: string): boolean {
  try {
    const parsed = new URL(oauthUrl)
    const clientId = parsed.searchParams.get('client_id')?.trim()
    const redirectUri = parsed.searchParams.get('redirect_uri')?.trim()
    const state = parsed.searchParams.get('state')?.trim()
    if (!clientId || clientId === 'undefined' || clientId === 'null') {
      console.error('[square/oauth] Connect blocked: client_id missing or invalid in authorize URL', {
        oauthUrl,
      })
      return false
    }
    if (!redirectUri) {
      console.error('[square/oauth] Connect blocked: redirect_uri missing in authorize URL', {
        oauthUrl,
      })
      return false
    }
    if (!state) {
      console.error('[square/oauth] Connect blocked: state missing in authorize URL', { oauthUrl })
      return false
    }
    if (oauthUrl.includes('scope=') && oauthUrl.includes('%2B')) {
      console.error('[square/oauth] Connect blocked: scope uses %2B instead of + separators', {
        oauthUrl,
      })
      return false
    }
    return true
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[square/oauth] Connect blocked: invalid authorize URL', message, { oauthUrl })
    return false
  }
}

export function ConnectSquareButton({ oauthUrl }: { oauthUrl: string }) {
  const oauthReady = isValidSquareOAuthUrl(oauthUrl)

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (!oauthReady) {
      event.preventDefault()
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">Connect your Square account</span>
        <Tooltip>
          <TooltipTrigger type="button"><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
          <TooltipContent className="max-w-xs">Connect your Square merchant account to receive booth payment payouts directly to your bank account.</TooltipContent>
        </Tooltip>
      </div>
      {!oauthReady ? (
        <p className="text-sm text-terracotta-800" role="alert">
          Square OAuth URL is misconfigured. Check the browser console and verify{' '}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SQUARE_APP_ID</code> and{' '}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_APP_URL</code> in your environment.
        </p>
      ) : null}
      <a href={oauthUrl} className="block" onClick={handleClick} aria-disabled={!oauthReady}>
        <Button
          className="w-full bg-[#006AFF] hover:bg-[#0057CC] text-white"
          disabled={!oauthReady}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Connect with Square
        </Button>
      </a>
    </div>
  )
}
