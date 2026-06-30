import type { SupabaseClient, UserIdentity } from '@supabase/supabase-js'
import {
  OAUTH_PROVIDER_ORDER,
  OAUTH_PROVIDERS,
  type OAuthProviderId,
} from '@/lib/auth/oauth-providers'

export type ConnectedIdentity = {
  provider: string
  label: string
  linkedAt: string | null
  identity: UserIdentity
}

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email & password',
  phone: 'Phone',
  ...Object.fromEntries(
    OAUTH_PROVIDER_ORDER.map((id) => [OAUTH_PROVIDERS[id].supabaseProvider, OAUTH_PROVIDERS[id].label])
  ),
}

export function identityProviderLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider
}

export function hasEmailPasswordIdentity(identities: UserIdentity[]): boolean {
  return identities.some((identity) => identity.provider === 'email')
}

export function hasOAuthIdentity(identities: UserIdentity[]): boolean {
  return identities.some((identity) => identity.provider !== 'email' && identity.provider !== 'phone')
}

export function linkedOAuthProviderIds(identities: UserIdentity[]): OAuthProviderId[] {
  const linked = new Set(identities.map((identity) => identity.provider))
  return OAUTH_PROVIDER_ORDER.filter((id) => linked.has(OAUTH_PROVIDERS[id].supabaseProvider))
}

export function missingOAuthProviderIds(identities: UserIdentity[]): OAuthProviderId[] {
  const linked = linkedOAuthProviderIds(identities)
  return OAUTH_PROVIDER_ORDER.filter((id) => !linked.includes(id))
}

export function mapConnectedIdentities(identities: UserIdentity[]): ConnectedIdentity[] {
  return identities.map((identity) => ({
    provider: identity.provider,
    label: identityProviderLabel(identity.provider),
    linkedAt: identity.created_at ?? null,
    identity,
  }))
}

export async function fetchUserIdentities(
  supabase: SupabaseClient
): Promise<{ identities: UserIdentity[]; error: string | null }> {
  const { data, error } = await supabase.auth.getUserIdentities()
  if (error) {
    return { identities: [], error: error.message }
  }
  return { identities: data?.identities ?? [], error: null }
}
