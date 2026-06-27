import type { ReactNode } from 'react'
import { SiteAmbientBackdrop } from '@/components/layout/site-ambient-backdrop'
import { PageBackBar } from '@/components/navigation/page-back-bar'
import { cn } from '@/lib/utils'

interface SiteContentShellProps {
  children: ReactNode
  className?: string
  /** When false, omit the standalone back bar (e.g. multi-portal nav shows back inline). */
  showBackBar?: boolean
}

/** Wraps scrollable page content with the site-wide ambient background. */
export function SiteContentShell({
  children,
  className,
  showBackBar = true,
}: SiteContentShellProps) {
  return (
    <div className={cn('site-surface relative min-h-0 flex-1', className)}>
      <SiteAmbientBackdrop />
      {showBackBar ? <PageBackBar /> : null}
      <div className="relative z-[1] site-main-gutter">{children}</div>
    </div>
  )
}
