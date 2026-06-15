import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'

export const INITIAL_LOADER = {
  fps: 60,
  /** Main reveal completes; hold here until the page finishes loading. */
  holdFrame: 420,
  /** Full sequence length before dismiss is allowed. */
  totalFrames: 540,
  /** Outro fade length in frames (after hold). */
  outroFrames: 90,
} as const

export type InitialLoaderPhase = 'intro' | 'hold' | 'outro' | 'complete'

export type InitialLoaderFrame = {
  globalFrame: number
  progress: number
  phase: InitialLoaderPhase
}

export type InitialLoaderController = {
  destroy: () => void
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
}

/** Map frame index to normalized animation progress (0–1) for the reveal sequence. */
export function initialLoaderProgress(globalFrame: number): number {
  const revealEnd = INITIAL_LOADER.holdFrame
  return easeOutCubic(clamp(globalFrame / revealEnd, 0, 1))
}

export function initialLoaderFrame(globalFrame: number): InitialLoaderFrame {
  const { holdFrame, totalFrames } = INITIAL_LOADER
  let phase: InitialLoaderPhase = 'intro'
  if (globalFrame >= totalFrames) phase = 'complete'
  else if (globalFrame >= holdFrame) phase = 'outro'
  else if (globalFrame >= holdFrame - 12) phase = 'hold'

  const progress =
    globalFrame >= holdFrame
      ? 1 - easeInOutCubic(clamp((globalFrame - holdFrame) / (totalFrames - holdFrame), 0, 1)) * 0.08
      : initialLoaderProgress(globalFrame)

  return { globalFrame, progress, phase }
}

export function createInitialLoaderController({
  onFrame,
  onReadyToDismiss,
}: {
  onFrame: (frame: InitialLoaderFrame) => void
  onReadyToDismiss: () => void
}): InitialLoaderController {
  let destroyed = false
  const { fps, holdFrame, totalFrames } = INITIAL_LOADER
  const frameDuration = 1000 / fps

  let pageLoaded =
    typeof document !== 'undefined' && document.readyState === 'complete'
  let animationComplete = false
  let pausedForLoad = false
  let globalFrame = 0
  let rafId: number | null = null
  let lastTimestamp: number | null = null
  let maxWaitTimer: number | null = null

  function maybeDismiss() {
    if (destroyed) return
    if (pageLoaded && animationComplete) onReadyToDismiss()
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

    if (lastTimestamp == null) lastTimestamp = timestamp

    const elapsed = timestamp - lastTimestamp
    if (elapsed >= frameDuration) {
      const steps = Math.floor(elapsed / frameDuration)
      lastTimestamp += steps * frameDuration

      if (!pausedForLoad) {
        globalFrame = Math.min(totalFrames, globalFrame + steps)
        if (globalFrame >= holdFrame && !pageLoaded) {
          globalFrame = holdFrame
          pausedForLoad = true
        }
        if (globalFrame >= totalFrames) animationComplete = true
      }

      onFrame(initialLoaderFrame(globalFrame))
      maybeDismiss()
    }

    if (!animationComplete) rafId = window.requestAnimationFrame(tick)
  }

  onFrame(initialLoaderFrame(0))
  rafId = window.requestAnimationFrame(tick)

  if (!pageLoaded) window.addEventListener('load', onWindowLoad, { once: true })

  maxWaitTimer = window.setTimeout(() => {
    pageLoaded = true
    animationComplete = true
    globalFrame = totalFrames
    onFrame(initialLoaderFrame(totalFrames))
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
