import { UserManagementPanel } from '@/components/admin/user-management-panel'

export const metadata = {
  title: 'Users | Admin',
}

export default function AdminUsersPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold text-foreground">Users</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search accounts by email, name, user ID, or wallet paddle. Manage roles, flags, coordinator
          moderation, and auth controls.
        </p>
      </div>
      <UserManagementPanel />
    </div>
  )
}
