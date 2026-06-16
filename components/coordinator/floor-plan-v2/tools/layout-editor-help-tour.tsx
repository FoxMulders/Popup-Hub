'use client'

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  findLayoutHelpTarget,
  type LayoutHelpTargetId,
  type LayoutHelpTourStep,
} from '@/lib/floor-plan/layout-editor-help-tours'

interface HighlightBox {
  top: number
  left: number
  width: number
  height: number
}

const TARGET_PAD = 6
const VIEWPORT_MARGIN = 8
const HEADER_CLEARANCE = 64
const CARD_MARGIN = 12
const CARD_ESTIMATED_HEIGHT = 280

function measureTarget(targetId: LayoutHelpTargetId): HighlightBox | null {
  const el = document.querySelector(`[data-layout-help="${targetId}"]`)
  if (!el) return null

  const rect = el.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight

  let top = rect.top - TARGET_PAD
  let left = rect.left - TARGET_PAD
  let width = rect.width + TARGET_PAD * 2
  let height = rect.height + TARGET_PAD * 2

  if (left < VIEWPORT_MARGIN) {
    const shift = VIEWPORT_MARGIN - left
    left = VIEWPORT_MARGIN
    width = Math.max(rect.width, width - shift)
  }
  if (top < VIEWPORT_MARGIN) {
    const shift = VIEWPORT_MARGIN - top
    top = VIEWPORT_MARGIN
    height = Math.max(rect.height, height - shift)
  }
  width = Math.min(width, vw - left - VIEWPORT_MARGIN)
  height = Math.min(height, vh - top - VIEWPORT_MARGIN)

  return {
    top,
    left,
    width: Math.max(0, width),
    height: Math.max(0, height),
  }
}

function scrollTargetIntoView(el: Element) {
  const rect = el.getBoundingClientRect()
  const block =
    rect.top < HEADER_CLEARANCE || rect.bottom > window.innerHeight - CARD_MARGIN
      ? 'start'
      : 'nearest'
  el.scrollIntoView({ block, behavior: 'auto', inline: 'nearest' })

  if (rect.top < HEADER_CLEARANCE) {
    const after = el.getBoundingClientRect()
    if (after.top < HEADER_CLEARANCE) {
      window.scrollBy({ top: after.top - HEADER_CLEARANCE, behavior: 'auto' })
    }
  }
}

function computeCardPosition(box: HighlightBox | null, cardHeight: number) {
  const margin = CARD_MARGIN
  const cardWidth = Math.min(360, window.innerWidth - margin * 2)
  const effectiveHeight = Math.max(cardHeight, CARD_ESTIMATED_HEIGHT)

  if (!box) {
    return {
      top: Math.max(margin, window.innerHeight / 2 - effectiveHeight / 2),
      left: (window.innerWidth - cardWidth) / 2,
      width: cardWidth,
    }
  }

  const spaceRight = window.innerWidth - (box.left + box.width) - margin
  const spaceBelow = window.innerHeight - (box.top + box.height) - margin
  const spaceAbove = box.top - margin
  const targetNearTop = box.top < window.innerHeight * 0.38
  const isLeftRailTarget =
    box.left < window.innerWidth * 0.42 &&
    box.width <= window.innerWidth * 0.45

  // Keep left-rail controls visible — park the card in the canvas area beside them.
  if (isLeftRailTarget && spaceRight >= cardWidth + margin) {
    let top = box.top + box.height / 2 - effectiveHeight / 2
    top = Math.max(
      margin,
      Math.min(top, window.innerHeight - effectiveHeight - margin)
    )
    return {
      top,
      left: box.left + box.width + margin,
      width: cardWidth,
    }
  }

  let top: number
  if (targetNearTop || spaceBelow >= effectiveHeight) {
    top = box.top + box.height + margin
  } else if (spaceAbove >= effectiveHeight) {
    top = box.top - effectiveHeight - margin
  } else {
    top = box.top + box.height + margin
  }

  top = Math.max(
    margin,
    Math.min(top, window.innerHeight - effectiveHeight - margin)
  )

  let left = box.left + box.width / 2 - cardWidth / 2
  left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin))

  return { top, left, width: cardWidth }
}

export function LayoutEditorHelpTourOverlay({
  steps,
  stepIndex,
  onStepIndexChange,
  onClose,
}: {
  steps: LayoutHelpTourStep[]
  stepIndex: number
  onStepIndexChange: (index: number) => void
  onClose: () => void
}) {
  const step = steps[stepIndex]
  const [box, setBox] = useState<HighlightBox | null>(null)
  const [cardHeight, setCardHeight] = useState(CARD_ESTIMATED_HEIGHT)
  const cardRef = useRef<HTMLDivElement>(null)
  const [resolvedTarget, setResolvedTarget] = useState<LayoutHelpTargetId | null>(
    null
  )

  const refreshBox = useCallback((targetId: LayoutHelpTargetId) => {
    setBox(measureTarget(targetId))
  }, [])

  const refreshBoxRafRef = useRef<number | null>(null)

  const scheduleRefreshBox = useCallback(
    (targetId: LayoutHelpTargetId) => {
      if (refreshBoxRafRef.current != null) {
        cancelAnimationFrame(refreshBoxRafRef.current)
      }
      refreshBoxRafRef.current = requestAnimationFrame(() => {
        refreshBoxRafRef.current = null
        refreshBox(targetId)
      })
    },
    [refreshBox]
  )

  const updateGeometry = useCallback(() => {
    if (!step) return
    const target = findLayoutHelpTarget(step.target, step.fallbackTargets)
    setResolvedTarget(target)
    if (!target) {
      setBox(null)
      return
    }

    const el = document.querySelector(`[data-layout-help="${target}"]`)
    if (!el) {
      setBox(null)
      return
    }

    scrollTargetIntoView(el)
    refreshBox(target)
    scheduleRefreshBox(target)
  }, [step, refreshBox, scheduleRefreshBox])

  useLayoutEffect(() => {
    setCardHeight(CARD_ESTIMATED_HEIGHT)
    updateGeometry()
  }, [updateGeometry, stepIndex])

  useLayoutEffect(() => {
    if (!resolvedTarget) return

    const onGeometryChange = () => scheduleRefreshBox(resolvedTarget)
    window.addEventListener('scroll', onGeometryChange, true)
    window.addEventListener('resize', onGeometryChange)
    return () => {
      window.removeEventListener('scroll', onGeometryChange, true)
      window.removeEventListener('resize', onGeometryChange)
      if (refreshBoxRafRef.current != null) {
        cancelAnimationFrame(refreshBoxRafRef.current)
      }
    }
  }, [resolvedTarget, scheduleRefreshBox])

  useLayoutEffect(() => {
    const el = cardRef.current
    if (!el) return
    const measured = el.getBoundingClientRect().height
    if (measured > 0 && Math.abs(measured - cardHeight) > 4) {
      setCardHeight(measured)
    }
  }, [step, stepIndex, box, cardHeight])

  const cardPosition = useMemo(
    () => computeCardPosition(box, cardHeight),
    [box, cardHeight]
  )

  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex >= steps.length - 1

  const overlay = (
    <div
      className="fixed inset-0 z-[250] pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="layout-help-tour-title"
    >
      {box ? (
        <>
          {/* Dim everything except the spotlight hole so the target stays fully visible. */}
          <div
            className="fixed z-[251] bg-slate-900/75 pointer-events-auto"
            style={{ top: 0, left: 0, right: 0, height: box.top }}
            aria-hidden
          />
          <div
            className="fixed z-[251] bg-slate-900/75 pointer-events-auto"
            style={{
              top: box.top,
              left: 0,
              width: box.left,
              height: box.height,
            }}
            aria-hidden
          />
          <div
            className="fixed z-[251] bg-slate-900/75 pointer-events-auto"
            style={{
              top: box.top,
              left: box.left + box.width,
              right: 0,
              height: box.height,
            }}
            aria-hidden
          />
          <div
            className="fixed z-[251] bg-slate-900/75 pointer-events-auto"
            style={{
              top: box.top + box.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            aria-hidden
          />
          <div
            className="pointer-events-none fixed z-[252] rounded-lg ring-2 ring-emerald-400 ring-offset-2 ring-offset-transparent"
            style={{
              top: box.top,
              left: box.left,
              width: box.width,
              height: box.height,
            }}
            aria-hidden
          />
        </>
      ) : (
        <div
          className="fixed inset-0 z-[251] bg-slate-900/75 pointer-events-auto"
          aria-hidden
        />
      )}

      <div
        ref={cardRef}
        className="pointer-events-auto fixed z-[253] rounded-xl border border-emerald-200/90 bg-white p-4 shadow-2xl"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
          width: cardPosition.width,
        }}
      >
        <div className="flex items-start gap-2">
          <span
            className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest text-white"
            aria-hidden
          >
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-800">
              Step {stepIndex + 1} of {steps.length}
              {resolvedTarget ? '' : ' · element not on this screen'}
            </p>
            <h2
              id="layout-help-tour-title"
              className="mt-0.5 font-heading text-base font-bold text-forest"
            >
              {step.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {step.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-stone-100 hover:text-foreground"
            aria-label="Close guided tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            disabled={isFirst}
            onClick={() => onStepIndexChange(stepIndex - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!isLast ? (
              <Button
                type="button"
                size="sm"
                className="h-8 gap-1 bg-forest hover:bg-forest/90"
                onClick={() => onStepIndexChange(stepIndex + 1)}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 bg-forest hover:bg-forest/90"
                onClick={onClose}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return overlay

  return createPortal(overlay, document.body)
}
