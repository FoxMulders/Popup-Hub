import { GuestNav } from '@/components/nav/guest-nav'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-canvas">
      <GuestNav />
      <div className="flex-1">{children}</div>
    </div>
  )
}
