import { PortalAwareShell } from '@/components/layout/portal-aware-shell'

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <PortalAwareShell>{children}</PortalAwareShell>
}
