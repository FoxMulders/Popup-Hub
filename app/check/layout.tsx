import { ShopperShell } from '@/components/shopper/shopper-shell'

export default function CheckLayout({ children }: { children: React.ReactNode }) {
  return <ShopperShell>{children}</ShopperShell>
}
