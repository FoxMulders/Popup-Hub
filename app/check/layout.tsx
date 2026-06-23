import { HubGuardShell } from '@/components/check/hubguard-shell'

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return <HubGuardShell>{children}</HubGuardShell>
}
