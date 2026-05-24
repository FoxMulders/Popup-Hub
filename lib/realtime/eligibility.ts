import type { Role } from '@/types/database'

/** Live Supabase channels for operational dashboards — not public patron browse. */
export function shouldUseOperationalRealtime(role: Role | string | undefined): boolean {
  return role === 'coordinator' || role === 'vendor'
}
