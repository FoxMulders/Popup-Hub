import { AppNav } from '@/components/nav/app-nav'
import type { Profile } from '@/types/database'

interface VendorShellProps {
  profile: Profile
  approvalCount: number
  children: React.ReactNode
}

export function VendorShell({ profile, approvalCount, children }: VendorShellProps) {
  return (
    <div className="market-page min-h-screen">
      <AppNav profile={profile} vendorPortal approvalCount={approvalCount} />
      <main>{children}</main>
    </div>
  )
}
