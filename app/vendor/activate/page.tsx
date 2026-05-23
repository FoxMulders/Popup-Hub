import { Suspense } from 'react'
import VendorActivatePage from './vendor-activate-client'

export default function Page() {
  return (
    <Suspense fallback={<div className="px-4 py-16 text-center text-sm text-muted-foreground">Loading…</div>}>
      <VendorActivatePage />
    </Suspense>
  )
}
