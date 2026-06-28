import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveActivePortal, type ActivePortal } from '@/lib/portals/active-portal'
import { hashWidgetToken } from '@/lib/widget/token-crypto'
import type { WidgetAuthContext, WidgetPersona } from '@/lib/widget/types'
import type { Profile, Role } from '@/types/database'

export type WidgetAuthResult =
  | { ok: true; context: WidgetAuthContext }
  | { ok: false; status: number; error: string }

function resolveWidgetPersona(
  role: Role | string | null | undefined,
  activePortal: ActivePortal,
  isAdmin?: boolean
): WidgetPersona {
  if (activePortal === 'coordinator' && (role === 'coordinator' || isAdmin === true)) {
    return 'coordinator'
  }
  if (activePortal === 'vendor' && role === 'vendor') {
    return 'vendor'
  }
  return 'patron'
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

/** Verify widget Bearer token using service-role client (bypasses RLS for hash lookup). */
export async function authenticateWidgetRequest(
  request: Request,
  service: SupabaseClient
): Promise<WidgetAuthResult> {
  const raw = extractBearerToken(request)
  if (!raw) {
    return { ok: false, status: 401, error: 'Missing Bearer token' }
  }

  const tokenHash = hashWidgetToken(raw)
  const { data: row, error } = await service
    .from('widget_tokens')
    .select('id, user_id, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, status: 401, error: 'Invalid widget token' }
  }

  if (row.revoked_at) {
    return { ok: false, status: 401, error: 'Widget token revoked' }
  }

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, is_admin')
    .eq('id', row.user_id)
    .maybeSingle()

  const role = (profile?.role ?? 'shopper') as Role
  const activePortal = resolveActivePortal(undefined, profile as Profile | null)
  const persona = resolveWidgetPersona(role, activePortal, profile?.is_admin === true)

  void service
    .from('widget_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id)

  return {
    ok: true,
    context: {
      userId: row.user_id,
      role,
      activePortal,
      persona,
      tokenId: row.id,
    },
  }
}

export { resolveWidgetPersona }
