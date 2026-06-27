import { OrganizerClaimAdminPanel } from '@/components/admin/organizer-claim-admin-panel'

export default function AdminOrganizerClaimsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground">Organizer claims</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Review coordinator requests to claim HubGuard organizer profiles before they can respond to
          reviews or sync markets.
        </p>
      </div>
      <OrganizerClaimAdminPanel />
    </div>
  )
}
