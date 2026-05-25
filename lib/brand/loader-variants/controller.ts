import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'
import {
  computeVariantFrame,
  getVariantHoldFrame,
  getVariantTotalFrames,
  LOADER_VARIANTS,
  type LoaderVariantId,
} from '@/lib/brand/loader-variants/registry'
import { LOADER_LAYOUT, type LoaderSceneFrame } from '@/lib/brand/loader-variants/shared'

export type LoaderControllerMode = 'initial' | 'replay'

export type LoaderController = {
  destroy: () => void
}

export function createLoaderController({
  variantId,
  mode,
  onFrame,
  onReadyToDismiss,
}: {
  variantId: LoaderVariantId
  mode: LoaderControllerMode
  onFrame: (frame: LoaderSceneFrame) => void
  onReadyToDismiss: () => void
}): LoaderController {
  let destroyed = false
  const variant = LOADER_VARIANTS[variantId]
  const totalFrames = getVariantTotalFrames(variant)
  const holdFrame = mode === 'initial' ? getVariantHoldFrame(variant) : null

  let pageLoaded =
    mode === 'replay' ||
    (typeof document !== 'undefined' && document.readyState === 'complete')
  let animationComplete = false
  let pausedForLoad = false
  let globalFrame = 0
  let rafId: number | null = null
  let lastTimestamp: number | null = null
  let maxWaitTimer: number | null = null

  const frameDuration = 1000 / LOADER_LAYOUT.fps

  function maybeDismiss() {
    if (destroyed) return
    if (pageLoaded && animationComplete) {
      onReadyToDismiss()
    }
  }

  function onWindowLoad() {
    pageLoaded = true
    if (pausedForLoad) {
      pausedForLoad = false
      lastTimestamp = null
    }
    maybeDismiss()
  }

  function tick(timestamp: number) {
    if (destroyed) return

    if (lastTimestamp == null) {
      lastTimestamp = timestamp
    }

    const elapsed = timestamp - lastTimestamp
    if (elapsed >= frameDuration) {
      const steps = Math.floor(elapsed / frameDuration)
      lastTimestamp += steps * frameDuration

      if (!pausedForLoad) {
        globalFrame = Math.min(totalFrames, globalFrame + steps)
        if (holdFrame != null && globalFrame >= holdFrame && !pageLoaded) {
          globalFrame = holdFrame
          pausedForLoad = true
        }
        if (globalFrame >= totalFrames) {
          animationComplete = true
        }
      }

      onFrame(computeVariantFrame(variantId, globalFrame))
      maybeDismiss()
    }

    if (!animationComplete) {
      rafId = window.requestAnimationFrame(tick)
    }
  }

  onFrame(computeVariantFrame(variantId, 0))
  rafId = window.requestAnimationFrame(tick)

  if (mode === 'initial' && !pageLoaded) {
    window.addEventListener('load', onWindowLoad, { once: true })
  }

  maxWaitTimer = window.setTimeout(() => {
    pageLoaded = true
    animationComplete = true
    globalFrame = totalFrames
    onFrame(computeVariantFrame(variantId, totalFrames))
    maybeDismiss()
  }, POPUP_LOADER.maxWaitMs)

  return {
    destroy: () => {
      destroyed = true
      window.removeEventListener('load', onWindowLoad)
      if (rafId != null) window.cancelAnimationFrame(rafId)
      if (maxWaitTimer != null) window.clearTimeout(maxWaitTimer)
    },
  }
}
