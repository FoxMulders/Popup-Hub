'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  TOOLTIP_HOVER_DELAY_MS,
  dismissActiveTooltip,
} from '@/components/coordinator/tooltip-wrapper'
import { cn } from '@/lib/utils'

/** Left dashboard rail width — matches `w-80` (20rem @ 16px). */
export const QA_DASHBOARD_SIDEBAR_WIDTH_PX = 320

interface TooltipWrapperQaProps {
  text: string
  children: ReactNode
  /** When true, flip tooltip to the right if it would clip the left sidebar. */
  sidebarAware?: boolean
}

type TooltipListener = (activeId: string | null) => void

let activeTooltipId: string | null = null
const tooltipListeners = new Set<TooltipListener>()

function notifyTooltipListeners(activeId: string | null) {
  activeTooltipId = activeId
  for (const listener of tooltipListeners) {
    listener(activeId)
  }
}

interface TooltipPosition {
  top: number
  left: number
  placement: 'top' | 'right'
}

function measureTooltipPosition(
  anchor: HTMLElement,
  tooltipEl: HTMLElement | null,
  sidebarAware: boolean
): TooltipPosition {
  const rect = anchor.getBoundingClientRect()
  const tooltipWidth = tooltipEl?.offsetWidth ?? 0
  const tooltipHeight = tooltipEl?.offsetHeight ?? 24
  const centerX = rect.left + rect.width / 2
  const wouldClipLeft =
    sidebarAware && tooltipWidth > 0
      ? centerX - tooltipWidth / 2 < QA_DASHBOARD_SIDEBAR_WIDTH_PX + 8
      : false

  if (wouldClipLeft) {
    return {
      top: rect.top + rect.height / 2 - tooltipHeight / 2,
      left: rect.right + 8,
      placement: 'right',
    }
  }

  return {
    top: rect.top - tooltipHeight - 8,
    left: centerX,
    placement: 'top',
  }
}

/**
 * QA tooltip — portals to `document.body`, `z-50`, with sidebar bounds
 * checking so hints are not clipped by the left rail `overflow-hidden`.
 */
export function TooltipWrapperQa({
  text,
  children,
  sidebarAware = true,
}: TooltipWrapperQaProps) {
  const id = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({
    top: 0,
    left: 0,
    placement: 'top',
  })
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor) return
    setPosition(
      measureTooltipPosition(anchor, tooltipRef.current, sidebarAware)
    )
  }, [sidebarAware])

  useEffect(() => {
    const onActiveChange = (nextId: string | null) => {
      if (nextId !== id) setVisible(false)
    }
    tooltipListeners.add(onActiveChange)
    return () => {
      tooltipListeners.delete(onActiveChange)
      if (timerRef.current) clearTimeout(timerRef.current)
      if (activeTooltipId === id) notifyTooltipListeners(null)
    }
  }, [id])

  useLayoutEffect(() => {
    if (!visible) return
    updatePosition()
    const onLayout = () => updatePosition()
    window.addEventListener('scroll', onLayout, true)
    window.addEventListener('resize', onLayout)
    return () => {
      window.removeEventListener('scroll', onLayout, true)
      window.removeEventListener('resize', onLayout)
    }
  }, [updatePosition, visible])

  const cancelPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleShow = useCallback(() => {
    cancelPending()
    notifyTooltipListeners(null)
    setVisible(false)
    timerRef.current = setTimeout(() => {
      notifyTooltipListeners(id)
      setVisible(true)
      timerRef.current = null
    }, TOOLTIP_HOVER_DELAY_MS)
  }, [cancelPending, id])

  const hide = useCallback(() => {
    cancelPending()
    if (activeTooltipId === id) notifyTooltipListeners(null)
    setVisible(false)
  }, [cancelPending, id])

  const portalRoot =
    typeof document !== 'undefined' ? document.body : null

  return (
    <>
      <div
        ref={anchorRef}
        className="relative inline-block"
        onMouseEnter={scheduleShow}
        onMouseLeave={hide}
        onFocus={scheduleShow}
        onBlur={hide}
      >
        {children}
      </div>
      {visible && portalRoot
        ? createPortal(
            <div
              ref={tooltipRef}
              role="tooltip"
              className={cn(
                'pointer-events-none fixed z-50 rounded-none border-2 border-black bg-zinc-900 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white whitespace-nowrap shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]',
                position.placement === 'top' && '-translate-x-1/2',
                position.placement === 'right' && '-translate-y-1/2'
              )}
              style={{ top: position.top, left: position.left }}
            >
              {text}
            </div>,
            portalRoot
          )
        : null}
    </>
  )
}

export { dismissActiveTooltip }
