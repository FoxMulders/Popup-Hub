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

/** Mandatory hover delay before canvas/toolbar tooltips render. */
export const TOOLTIP_HOVER_DELAY_MS = 400

/** Dashboard left rail width — tooltips flip right when they would clip past this edge. */
export const QA_SIDEBAR_WIDTH_PX = 320

interface TooltipWrapperProps {
  text: string
  children: ReactNode
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
  return Math.min(Math.max(text.length * 7 + 20, 48), 280)
}

function computePortalPosition(
  anchor: DOMRect,
  tooltipWidth: number
): Pick<CSSProperties, 'top' | 'left' | 'transform'> {
  const margin = 8
  const centeredLeft = anchor.left + anchor.width / 2 - tooltipWidth / 2

  if (centeredLeft < QA_SIDEBAR_WIDTH_PX) {
    return {
      top: anchor.top + anchor.height / 2,
      left: anchor.right + margin,
      transform: 'translateY(-50%)',
    }
  }

  return {
    top: anchor.top - margin,
    left: anchor.left + anchor.width / 2,
    transform: 'translate(-50%, -100%)',
  }
}

/** Portal tooltip — escapes sidebar overflow; flips right when past `w-80`. */
export function TooltipWrapperQa({ text, children }: TooltipWrapperProps) {
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
    const rect = anchorRef.current.getBoundingClientRect()
    setPosition(computePortalPosition(rect, estimateTooltipWidth(text)))
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
            className="pointer-events-none fixed z-50 rounded-none border-2 border-black bg-zinc-900 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider whitespace-nowrap text-white shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
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
        className="relative inline-block"
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
