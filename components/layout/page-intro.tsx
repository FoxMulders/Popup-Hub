import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageIntroProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

/** Portal and workspace page headers — matches marketing typography without full hero band. */
export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageIntroProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        className
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">{eyebrow}</p>
        ) : null}
        <h1
          className={cn(
            'text-2xl font-bold tracking-tight text-foreground sm:text-3xl',
            eyebrow ? 'mt-1' : ''
          )}
        >
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  )
}
