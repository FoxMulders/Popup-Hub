import { PublishAssistAdminPanel } from '@/components/admin/publish-assist-admin-panel'
import { AdminQueueNav } from '@/components/admin/admin-queue-nav'

export default function AdminPublishAssistPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-foreground">Publish assist requests</h1>
        <p className="text-sm text-muted-foreground">
          Coordinators blocked from publishing can request admin help. Approve to publish their
          draft market without editing its content.
        </p>
      </div>
      <AdminQueueNav />
      <PublishAssistAdminPanel />
    </div>
  )
}
