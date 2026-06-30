import type { Provider, SupabaseClient } from '@supabase/supabase-js'
import {
  type OAuthProviderId,
  OAUTH_PROVIDERS,
  oauthProviderLabel,
} from '@/lib/auth/oauth-providers'
import {
  buildNativeOAuthCallbackUrl,
  buildOAuthCallbackUrl,
  getOAuthOrigin,
} from '@/lib/auth/oauth-callback-url'
import { isNativeApp } from '@/lib/mobile/native-app'
import {
  markNativeOAuthDeepLinkReturn,
  onNativeOAuthBrowserFinished,
} from '@/lib/auth/native-oauth'

export type LinkOAuthParams = Record<string, string | null | undefined>

export type LinkOAuthResult =
  | { mode: 'redirect' }
  | { mode: 'browser'; opened: true }
  | { mode: 'error'; message: string }

function oauthQueryParams(provider: Provider): Record<string, string> {
  if (provider === 'google' || provider === 'azure') {
    return { prompt: 'select_account' }
  }
  return {}
}

/** Link an OAuth provider to the currently signed-in user. */
export async function linkOAuthIdentity(
  supabase: SupabaseClient,
  providerId: OAuthProviderId,
  params?: LinkOAuthParams
): Promise<LinkOAuthResult> {
  const { supabaseProvider } = OAUTH_PROVIDERS[providerId]
  const providerLabel = oauthProviderLabel(providerId)

  const linkParams = { ...params, link: '1' }
  const redirectTo = isNativeApp()
    ? buildNativeOAuthCallbackUrl(linkParams)
    : buildOAuthCallbackUrl(getOAuthOrigin(), linkParams)

  const oauthOptions = {
    redirectTo,
    queryParams: oauthQueryParams(supabaseProvider),
  }

  if (!isNativeApp()) {
    const { error } = await supabase.auth.linkIdentity({
      provider: supabaseProvider,
      options: oauthOptions,
    })
    if (error) return { mode: 'error', message: error.message }
    return { mode: 'redirect' }
  }

  const { data, error } = await supabase.auth.linkIdentity({
    provider: supabaseProvider,
    options: {
      ...oauthOptions,
      skipBrowserRedirect: true,
    },
  })

  if (error) return { mode: 'error', message: error.message }

  const url = data?.url
  if (!url) {
    return {
      mode: 'error',
      message: `${providerLabel} linking could not be started. Please try again.`,
    }
  }

  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.open({ url })
    return { mode: 'browser', opened: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not open the sign-in browser.'
    return { mode: 'error', message }
  }
}

export { markNativeOAuthDeepLinkReturn, onNativeOAuthBrowserFinished }
