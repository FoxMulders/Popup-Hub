'use client'

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'

/** Mandatory hover delay before canvas/toolbar tooltips render. */
export const TOOLTIP_HOVER_DELAY_MS = 400

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

/** Neobrutalist high-contrast tooltip — 400ms debounce, one alive at a time. */
export function TooltipWrapper({ text, children }: TooltipWrapperProps) {
  const id = useId()
  const [visible, setVisible] = useState(false)
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

  return (
    <div
      className="relative inline-block"
      onMouseEnter={scheduleShow}
      onMouseLeave={hide}
      onFocus={scheduleShow}
      onBlur={hide}
    >
      {children}
      {visible ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-[99999] mb-2 -translate-x-1/2 rounded-none border-2 border-black bg-zinc-900 px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wider text-white whitespace-nowrap shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
        >
          {text}
        </div>
      ) : null}
    </div>
  )
}
