'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { COORDINATOR_STUDIO_PATH, coordinatorStudioHref } from '@/lib/coordinator/coordinator-routes'
import { cn } from '@/lib/utils'
import { setupWizardStepHref } from '@/lib/wizard/setup-step-url'

export type DesignerExitTarget =
  | 'auto'
  | 'event-setup'
  | 'event-overview'
  | 'studio'
  /** @deprecated Use `studio`. */
  | 'dashboard'

function isStudioExitTarget(target: DesignerExitTarget): boolean {
  return target === 'studio' || target === 'dashboard'
}

export function resolveDesignerExitHref(
  eventId: string | null | undefined,
  eventStatus?: string | null,
  target: DesignerExitTarget = 'auto'
): string {
  if (isStudioExitTarget(target)) {
    return eventId ? coordinatorStudioHref(eventId) : COORDINATOR_STUDIO_PATH
  }
  if (!eventId) return COORDINATOR_STUDIO_PATH
  if (target === 'event-setup') {
    return setupWizardStepHref(eventId, 3)
  }
  if (target === 'event-overview') {
    return `/coordinator/events/${eventId}`
  }
  if (eventStatus === 'draft') {
    return setupWizardStepHref(eventId, 3)
  }
  return `/coordinator/events/${eventId}`
}

export function resolveDesignerExitLabel(
  eventName: string | null | undefined,
  eventStatus?: string | null,
  target: DesignerExitTarget = 'auto',
  compact = false
): string {
  if (isStudioExitTarget(target)) {
    return compact ? 'Blueprint Studio' : 'Open Blueprint Studio'
  }
  const useSetup =
    target === 'event-setup' || (target === 'auto' && eventStatus === 'draft')
  if (useSetup) {
    return compact ? 'Event setup' : 'Back to Event Setup'
  }
  const trimmed = eventName?.trim()
  if (trimmed) {
    return compact ? 'Event overview' : `Back to ${trimmed}`
  }
  return 'Event overview'
}

export function CommandCenterExitLink({
  eventId,
  eventName,
  eventStatus,
  target = 'auto',
  className,
  compact = false,
  prominent = false,
  onBeforeNavigate,
}: {
  eventId?: string | null
  eventName?: string | null
  eventStatus?: string | null
  target?: DesignerExitTarget
  className?: string
  /** Smaller label for side rails */
  compact?: boolean
  /** High-contrast styling for fullscreen / immersive canvas */
  prominent?: boolean
  /** Exit immersive or native fullscreen before routing */
  onBeforeNavigate?: () => void
}) {
  const href = resolveDesignerExitHref(eventId, eventStatus, target)
  const label = resolveDesignerExitLabel(eventName, eventStatus, target, compact)

  return (
    <Link
      href={href}
      prefetch
      onClick={() => onBeforeNavigate?.()}
      className={cn(
        buttonVariants({ variant: prominent ? 'default' : 'ghost', size: 'sm' }),
        prominent
          ? 'relative z-[10001] gap-1.5 bg-forest font-semibold text-white shadow-md hover:bg-forest/90 pointer-events-auto'
          : 'gap-1.5 text-stone-700 hover:text-forest pointer-events-auto',
        compact && !prominent && 'h-8 px-2 text-xs',
        compact && prominent && 'h-7 gap-1 px-2 text-[11px]',
        prominent && !compact && 'h-9 px-3 text-sm',
        className
      )}
    >
      <ArrowLeft
        className={cn('shrink-0', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </Link>
  )
}

/** Router-driven exit control for toolbars that cannot use Link styling. */
export function CommandCenterExitButton({
  eventId,
  eventName,
  eventStatus,
  target = 'auto',
  className,
  compact = false,
  prominent = false,
  onBeforeNavigate,
}: {
  eventId?: string | null
  eventName?: string | null
  eventStatus?: string | null
  target?: DesignerExitTarget
  className?: string
  compact?: boolean
  prominent?: boolean
  onBeforeNavigate?: () => void
}) {
  const router = useRouter()
  const label = resolveDesignerExitLabel(eventName, eventStatus, target, compact)

  return (
    <button
      type="button"
      onClick={() => {
        onBeforeNavigate?.()
        router.push(resolveDesignerExitHref(eventId, eventStatus, target))
      }}
      className={cn(
        prominent
          ? 'relative z-[10001] inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-forest px-3 text-sm font-semibold text-white shadow-md transition-colors hover:bg-forest/90 pointer-events-auto'
          : 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-semibold text-stone-700 transition-colors hover:bg-stone-100 hover:text-forest pointer-events-auto',
        className
      )}
      aria-label={label}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  )
}
