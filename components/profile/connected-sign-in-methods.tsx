'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { UserIdentity } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Loader2, Link2, Unlink } from 'lucide-react'
import { toast } from 'sonner'
import {
  fetchUserIdentities,
  hasEmailPasswordIdentity,
  identityProviderLabel,
  linkedOAuthProviderIds,
  missingOAuthProviderIds,
} from '@/lib/auth/connected-identities'
import {
  linkOAuthIdentity,
  onNativeOAuthBrowserFinished,
} from '@/lib/auth/link-oauth'
import { type OAuthProviderId, OAUTH_PROVIDERS, OAUTH_PROVIDER_ORDER } from '@/lib/auth/oauth-providers'
import { formatExistingAccountAuthMessage } from '@/lib/auth/auth-error-messages'

export function ConnectedSignInMethods() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingProvider, setPendingProvider] = useState<OAuthProviderId | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null)

  const refreshIdentities = useCallback(async () => {
    setLoading(true)
    const { identities: next, error } = await fetchUserIdentities(supabase)
    setLoading(false)
    if (error) {
      toast.error('Could not load connected sign-in methods')
      return
    }
    setIdentities(next)
  }, [supabase])

  useEffect(() => {
    void refreshIdentities()
  }, [refreshIdentities])

  useEffect(() => {
    if (searchParams.get('linked') === '1') {
      toast.success('Sign-in method connected successfully')
      router.replace('/profile', { scroll: false })
    }
  }, [router, searchParams])

  useEffect(() => {
    onNativeOAuthBrowserFinished((reason) => {
      setPendingProvider(null)
      if (reason === 'completed') {
        void refreshIdentities()
      } else if (reason === 'cancelled') {
        toast.message('Linking was cancelled.')
      }
    })
    return () => {
      onNativeOAuthBrowserFinished(null)
    }
  }, [refreshIdentities])

  async function handleLink(providerId: OAuthProviderId) {
    setPendingProvider(providerId)
    const result = await linkOAuthIdentity(supabase, providerId)
    if (result.mode === 'error') {
      setPendingProvider(null)
      toast.error(formatExistingAccountAuthMessage(result.message))
      return
    }
    if (result.mode === 'redirect') {
      setPendingProvider(null)
    }
  }

  async function handleUnlink(identity: UserIdentity) {
    if (identities.length < 2) {
      toast.error('You must keep at least one sign-in method connected.')
      return
    }

    setUnlinkingProvider(identity.provider)
    const { error } = await supabase.auth.unlinkIdentity(identity)
    setUnlinkingProvider(null)

    if (error) {
      toast.error(error.message)
      return
    }

    toast.success(`${identityProviderLabel(identity.provider)} disconnected`)
    await refreshIdentities()
  }

  const linkedOAuth = linkedOAuthProviderIds(identities)
  const missingOAuth = missingOAuthProviderIds(identities)
  const canUnlink = identities.length >= 2

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-foreground">Connected sign-in methods</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Link Google, Apple, Microsoft, or Facebook to the same Popup Hub account as your email
          sign-in.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading sign-in methods…
        </p>
      ) : (
        <ul className="space-y-2">
          {identities.map((identity) => (
            <li
              key={identity.id}
              className="flex items-center justify-between gap-3 rounded-xl border bg-canvas/50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {identityProviderLabel(identity.provider)}
                </p>
                {identity.identity_data?.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {String(identity.identity_data.email)}
                  </p>
                ) : null}
              </div>
              {canUnlink ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={unlinkingProvider !== null || pendingProvider !== null}
                  onClick={() => void handleUnlink(identity)}
                >
                  {unlinkingProvider === identity.provider ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      <Unlink className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Disconnect
                    </>
                  )}
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {missingOAuth.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Connect another provider
          </p>
          {missingOAuth.map((providerId) => {
            const { label } = OAUTH_PROVIDERS[providerId]
            const isPending = pendingProvider === providerId
            const isBusy = pendingProvider !== null

            return (
              <Button
                key={providerId}
                type="button"
                variant="outline"
                className="w-full min-h-11 gap-2 touch-manipulation"
                disabled={loading || (isBusy && !isPending) || unlinkingProvider !== null}
                onClick={() => void handleLink(providerId)}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Link2 className="h-4 w-4" aria-hidden />
                )}
                Connect {label}
              </Button>
            )
          })}
        </div>
      ) : linkedOAuth.length === OAUTH_PROVIDER_ORDER.length ? (
        <p className="text-xs text-muted-foreground">All supported social providers are connected.</p>
      ) : null}

      {!loading && !hasEmailPasswordIdentity(identities) ? (
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set a password below to sign in with email when social login is unavailable.
        </p>
      ) : null}
    </div>
  )
}
