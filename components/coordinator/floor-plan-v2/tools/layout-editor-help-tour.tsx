'use client'

import { useCallback, useLayoutEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  findLayoutHelpTarget,
  type LayoutHelpTargetId,
  type LayoutHelpTourStep,
} from '@/lib/floor-plan/layout-editor-help-tours'
import { cn } from '@/lib/utils'

interface HighlightBox {
  top: number
  left: number
  width: number
  height: number
}

function measureTarget(targetId: LayoutHelpTargetId): HighlightBox | null {
  const el = document.querySelector(`[data-layout-help="${targetId}"]`)
  if (!el) return null
  const pad = 6
  const rect = el.getBoundingClientRect()
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }
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
  const [resolvedTarget, setResolvedTarget] = useState<LayoutHelpTargetId | null>(
    null
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
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth', inline: 'nearest' })
      window.setTimeout(() => {
        setBox(measureTarget(target))
      }, 280)
    } else {
      setBox(null)
    }
  }, [step])

  useLayoutEffect(() => {
    updateGeometry()
    const onScroll = () => {
      if (!resolvedTarget) return
      setBox(measureTarget(resolvedTarget))
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [updateGeometry, resolvedTarget, stepIndex])

  const cardPosition = useMemo(() => {
    const margin = 12
    const cardWidth = Math.min(360, window.innerWidth - margin * 2)
    if (!box) {
      return {
        top: Math.max(margin, window.innerHeight / 2 - 120),
        left: (window.innerWidth - cardWidth) / 2,
        width: cardWidth,
      }
    }
    let top = box.top + box.height + margin
    const estimatedHeight = 200
    if (top + estimatedHeight > window.innerHeight - margin) {
      top = Math.max(margin, box.top - estimatedHeight - margin)
    }
    let left = box.left + box.width / 2 - cardWidth / 2
    left = Math.max(margin, Math.min(left, window.innerWidth - cardWidth - margin))
    return { top, left, width: cardWidth }
  }, [box])

  if (!step) return null

  const isFirst = stepIndex === 0
  const isLast = stepIndex >= steps.length - 1

  return (
    <div
      className="fixed inset-0 z-[250]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="layout-help-tour-title"
    >
      {box ? (
        <div
          className="pointer-events-none fixed z-[251] rounded-xl ring-4 ring-emerald-400 ring-offset-2 ring-offset-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.78)] transition-all duration-300 ease-out animate-pulse"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
          aria-hidden
        />
      ) : (
        <div
          className="fixed inset-0 z-[251] bg-slate-900/75"
          aria-hidden
        />
      )}

      <div
        className="fixed z-[252] rounded-xl border border-emerald-200/90 bg-white p-4 shadow-2xl"
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
}
