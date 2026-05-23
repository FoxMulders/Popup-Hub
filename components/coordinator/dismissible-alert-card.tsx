'use client'

import { cn } from '@/lib/utils'

interface DismissibleAlertCardProps {
  alertId: string
  title?: string
  dismissed?: boolean
  onDismiss: (alertId: string) => void
  variant?: 'warning' | 'error' | 'info'
  className?: string
  children: React.ReactNode
}

const VARIANT_STYLES = {
  warning: 'border-harvest-400 bg-harvest-50/90 text-harvest-900',
  error: 'border-terracotta-400 bg-terracotta-50/90 text-terracotta-900',
  info: 'border-stone-300 bg-canvas text-foreground',
}

export function DismissibleAlertCard({
  alertId,
  title,
  dismissed = false,
  onDismiss,
  variant = 'warning',
  className,
  children,
}: DismissibleAlertCardProps) {
  if (dismissed) return null

  return (
    <article
      className={cn(
        'relative market-panel p-4 pr-10 space-y-2 border-2',
        VARIANT_STYLES[variant],
        className
      )}
      role="alert"
      aria-live="polite"
    >
      <button
        type="button"
        aria-label="Close alert"
        title="Dismiss"
        className="absolute top-2 right-2 flex h-9 w-9 min-h-11 min-w-11 items-center justify-center rounded-lg border-2 border-current/30 bg-card/90 text-base font-bold text-current hover:bg-card active:translate-y-0.5 transition-all"
        onClick={() => onDismiss(alertId)}
      >
        <span aria-hidden>✕</span>
      </button>
      {title ? (
        <h3 className="text-xs font-heading font-semibold uppercase tracking-wide pr-6">{title}</h3>
      ) : null}
      {children}
    </article>
  )
}
