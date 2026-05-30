'use client'

import { usePathname } from 'next/navigation'
import { BuildVersionFooter } from '@/components/brand/build-version-footer'

/** Hides the global footer on routes that fill the viewport (command center CAD). */
export function SiteFooterGate() {
  const pathname = usePathname() ?? ''
  if (pathname === '/coordinator/dashboard') {
    return null
  }
  return <BuildVersionFooter />
}
