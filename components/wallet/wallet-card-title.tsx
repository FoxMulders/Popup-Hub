import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface WalletCardTitleProps {
  icon: ReactNode
  children: ReactNode
  trailing?: ReactNode
  className?: string
}

/** Card headings that wrap cleanly on narrow screens without clipping icons. */
export function WalletCardTitle({ icon, children, trailing, className }: WalletCardTitleProps) {
  return (
    <div className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {icon ? <span className="inline-flex shrink-0 items-center">{icon}</span> : null}
      <span className="min-w-0 text-base font-semibold leading-snug text-foreground">{children}</span>
      {trailing ? <span className="inline-flex shrink-0 items-center">{trailing}</span> : null}
    </div>
  )
}
