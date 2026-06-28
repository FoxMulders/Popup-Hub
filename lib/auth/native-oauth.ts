import type { Provider, SupabaseClient } from '@supabase/supabase-js'
import {
  type OAuthProviderId,
  OAUTH_PROVIDERS,
  oauthProviderLabel,
} from '@/lib/auth/oauth-providers'
import { buildNativeOAuthCallbackUrl, buildOAuthCallbackUrl, getOAuthOrigin } from '@/lib/auth/oauth-callback-url'
import { isNativeApp } from '@/lib/mobile/native-app'

export type OAuthParams = Record<string, string | null | undefined>

export type OAuthResult =
  | { mode: 'redirect' }
  | { mode: 'browser'; opened: true }
  | { mode: 'error'; message: string }

/** @deprecated Use OAuthParams */
export type GoogleOAuthParams = OAuthParams

/** @deprecated Use OAuthResult */
export type GoogleOAuthResult = OAuthResult

type BrowserFinishedReason = 'cancelled' | 'completed'
type BrowserFinishedListener = (reason: BrowserFinishedReason) => void

let browserFinishedListener: BrowserFinishedListener | null = null
let browserFinishedHandle: { remove: () => Promise<void> } | null = null
let nativeOAuthDeepLinkReturn = false

/** Mark that OAuth is completing via deep link (suppress cancel message on browser close). */
export function markNativeOAuthDeepLinkReturn(): void {
  nativeOAuthDeepLinkReturn = true
}

function consumeNativeOAuthDeepLinkReturn(): boolean {
  if (!nativeOAuthDeepLinkReturn) return false
  nativeOAuthDeepLinkReturn = false
  return true
}

/** Reset pending OAuth UI when the user closes the system browser without completing sign-in. */
export function onNativeOAuthBrowserFinished(listener: BrowserFinishedListener | null): void {
  browserFinishedListener = listener
}

async function ensureBrowserFinishedListener(): Promise<void> {
  if (browserFinishedHandle || typeof window === 'undefined' || !isNativeApp()) return

  try {
    const { Browser } = await import('@capacitor/browser')
    browserFinishedHandle = await Browser.addListener('browserFinished', () => {
      const reason: BrowserFinishedReason = consumeNativeOAuthDeepLinkReturn()
        ? 'completed'
        : 'cancelled'
      browserFinishedListener?.(reason)
    })
  } catch {
    /* @capacitor/browser only available in native shell */
  }
}

/** Close the system OAuth browser after a successful deep-link return. */
export async function closeNativeOAuthBrowser(): Promise<void> {
  if (!isNativeApp()) return

  try {
    const { Browser } = await import('@capacitor/browser')
    await Browser.close()
  } catch {
    /* ignore if browser was already closed */
  }
}

function oauthQueryParams(provider: Provider): Record<string, string> {
  if (provider === 'google' || provider === 'azure') {
    return { prompt: 'select_account' }
  }
  return {}
}

/** OAuth sign-in — system browser on native, default redirect on web. */
export async function signInWithOAuth(
  supabase: SupabaseClient,
  providerId: OAuthProviderId,
  params?: OAuthParams,
): Promise<OAuthResult> {
  const { supabaseProvider } = OAUTH_PROVIDERS[providerId]
  const providerLabel = oauthProviderLabel(providerId)

  const redirectTo = isNativeApp()
    ? buildNativeOAuthCallbackUrl(params)
    : buildOAuthCallbackUrl(getOAuthOrigin(), params)

  const oauthOptions = {
    redirectTo,
    queryParams: oauthQueryParams(supabaseProvider),
  }

  if (!isNativeApp()) {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: supabaseProvider,
      options: oauthOptions,
    })
    if (error) return { mode: 'error', message: error.message }
    return { mode: 'redirect' }
  }

  await ensureBrowserFinishedListener()

  const { data, error } = await supabase.auth.signInWithOAuth({
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
      message: `${providerLabel} sign-in could not be started. Please try again.`,
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

/** Google OAuth — system browser on native, default redirect on web. */
export async function signInWithGoogleOAuth(
  supabase: SupabaseClient,
  params?: OAuthParams,
): Promise<OAuthResult> {
  return signInWithOAuth(supabase, 'google', params)
}
