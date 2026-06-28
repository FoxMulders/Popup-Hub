import type { Provider } from '@supabase/supabase-js'

/** Supabase Auth provider ids exposed in the login/signup UI. */
export type OAuthProviderId = 'google' | 'apple' | 'azure' | 'facebook'

export type OAuthProviderConfig = {
  id: OAuthProviderId
  supabaseProvider: Provider
  label: string
}

export const OAUTH_PROVIDER_ORDER: OAuthProviderId[] = [
  'google',
  'apple',
  'azure',
  'facebook',
]

export const OAUTH_PROVIDERS: Record<OAuthProviderId, OAuthProviderConfig> = {
  google: {
    id: 'google',
    supabaseProvider: 'google',
    label: 'Google',
  },
  apple: {
    id: 'apple',
    supabaseProvider: 'apple',
    label: 'Apple',
  },
  azure: {
    id: 'azure',
    supabaseProvider: 'azure',
    label: 'Microsoft',
  },
  facebook: {
    id: 'facebook',
    supabaseProvider: 'facebook',
    label: 'Facebook',
  },
}

export function oauthProviderLabel(id: OAuthProviderId): string {
  return OAUTH_PROVIDERS[id].label
}
