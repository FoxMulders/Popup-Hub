import { ShopperShell } from '@/components/shopper/shopper-shell'

/** Profile settings always use patron browse chrome so Home / Discover stay reachable. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShopperShell>
      <div className="min-w-0 max-w-full overflow-x-hidden pb-24 md:pb-8">{children}</div>
    </ShopperShell>
  )
}
