import { ShopperShell } from '@/components/shopper/shopper-shell'

/** Profile settings always use patron browse chrome so Home / Discover stay reachable. */
export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <ShopperShell>{children}</ShopperShell>
}
