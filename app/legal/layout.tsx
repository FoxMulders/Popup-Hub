import { GuestNav } from '@/components/nav/guest-nav'
import { SiteContentShell } from '@/components/layout/site-content-shell'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-cream">
      <GuestNav />
      <SiteContentShell className="flex-1">{children}</SiteContentShell>
    </div>
  )
}
