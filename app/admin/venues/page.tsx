import { AdminVenueSubmissionsPanel } from '@/components/admin/admin-venue-submissions-panel'

export default function AdminVenuesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-foreground">Venue submissions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review new venues coordinators add when setting up markets.
        </p>
      </div>
      <AdminVenueSubmissionsPanel />
    </div>
  )
}
