import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CoordinatorVendorApproval,
  VendorAccessRequest,
  VendorAccessRequestStatus,
} from '@/types/database'

export async function countCoordinatorApprovals(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from('coordinator_vendor_approvals')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_user_id', userId)
  return count ?? 0
}

export async function hasCoordinatorApproval(
  supabase: SupabaseClient,
  userId: string,
  coordinatorId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('coordinator_vendor_approvals')
    .select('id')
    .eq('vendor_user_id', userId)
    .eq('coordinator_id', coordinatorId)
    .maybeSingle()
  return !!data
}

export async function getApprovedCoordinatorIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('coordinator_vendor_approvals')
    .select('coordinator_id')
    .eq('vendor_user_id', userId)
  return (data ?? []).map((row) => row.coordinator_id)
}

export async function getVendorAccessRequest(
  supabase: SupabaseClient,
  shopperId: string,
  coordinatorId: string
): Promise<VendorAccessRequest | null> {
  const { data } = await supabase
    .from('vendor_access_requests')
    .select('*')
    .eq('shopper_id', shopperId)
    .eq('coordinator_id', coordinatorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as VendorAccessRequest | null) ?? null
}

export function accessRequestStatusLabel(status: VendorAccessRequestStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending review'
    case 'approved':
      return 'Approved'
    case 'rejected':
      return 'Not approved'
    default:
      return status
  }
}

export type ApprovalWithCoordinator = CoordinatorVendorApproval & {
  coordinator?: { full_name: string } | null
}
