import { ShopperShell } from '@/components/shopper/shopper-shell'

export default function BrowseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <ShopperShell>{children}</ShopperShell>
}
