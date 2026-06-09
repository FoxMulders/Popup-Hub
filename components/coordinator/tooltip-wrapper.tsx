'use client'

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

/** Mandatory hover delay before canvas/toolbar tooltips render. */
export const TOOLTIP_HOVER_DELAY_MS = 400

/** Layout tools left rail — tooltips flip right when anchor is inside this width. */
export const LAYOUT_TOOLS_SIDEBAR_WIDTH_PX = 300

interface TooltipWrapperProps {
  text: string
  children: ReactNode
  /** Optional anchor sizing — use `w-full` when the trigger should span a flex column. */
  className?: string
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

/** Immediately dismiss any live tooltip — singleton lifecycle. */
export function dismissActiveTooltip() {
  notifyTooltipListeners(null)
}

function estimateTooltipWidth(text: string): number {
  return Math.min(Math.max(text.length * 7 + 16, 32), 280)
}

function estimateTooltipHeight(): number {
  return 32
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function computePortalPosition(
  anchor: DOMRect,
  tooltipWidth: number
): Pick<CSSProperties, 'top' | 'left' | 'transform'> {
  const margin = 8
  const tooltipHeight = estimateTooltipHeight()
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 1280
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800

  const inLeftRail = anchor.right <= LAYOUT_TOOLS_SIDEBAR_WIDTH_PX + 1

  if (inLeftRail) {
    const top = clamp(
      anchor.top + anchor.height / 2,
      margin + tooltipHeight / 2,
      viewportH - margin - tooltipHeight / 2
    )
    return {
      top,
      left: anchor.right + margin,
      transform: 'translateY(-50%)',
    }
  }

  const centeredLeft = anchor.left + anchor.width / 2 - tooltipWidth / 2
  const wouldClipLeft = centeredLeft < margin
  const wouldClipRight = centeredLeft + tooltipWidth > viewportW - margin

  if (wouldClipLeft || wouldClipRight) {
    const top = clamp(
      anchor.top + anchor.height / 2,
      margin + tooltipHeight / 2,
      viewportH - margin - tooltipHeight / 2
    )
    const left =
      wouldClipLeft && !wouldClipRight
        ? anchor.right + margin
        : wouldClipRight && !wouldClipLeft
          ? anchor.left - margin
          : anchor.right + margin
    return {
      top,
      left,
      transform: wouldClipRight && !wouldClipLeft ? 'translate(-100%, -50%)' : 'translateY(-50%)',
    }
  }

  return {
    top: anchor.top - margin,
    left: anchor.left + anchor.width / 2,
    transform: 'translate(-50%, -100%)',
  }
}

/** Neobrutalist high-contrast tooltip — portaled to document.body, 400ms debounce, one alive at a time. */
export function TooltipWrapper({ text, children, className }: TooltipWrapperProps) {
  const id = useId()
  const anchorRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<Pick<
    CSSProperties,
    'top' | 'left' | 'transform'
  > | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (!visible || !anchorRef.current) {
      setPosition(null)
      return
    }
    const update = () => {
      if (!anchorRef.current) return
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition(computePortalPosition(rect, estimateTooltipWidth(text)))
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [visible, text])

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

  const tooltip =
    visible && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[99999] h-auto w-max max-w-xs rounded-none border-2 border-black bg-zinc-900 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white whitespace-nowrap shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
            style={position}
          >
            {text}
          </div>,
          document.body
        )
      : null

  return (
    <>
      <div
        ref={anchorRef}
        className={cn(
          'relative inline-flex h-auto w-fit max-w-full shrink-0 self-start',
          className
        )}
        onMouseEnter={scheduleShow}
        onMouseLeave={hide}
        onFocus={scheduleShow}
        onBlur={hide}
      >
        {children}
      </div>
      {tooltip}
    </>
  )
}
