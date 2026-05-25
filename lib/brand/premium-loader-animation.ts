import { POPUP_LOADER } from '@/lib/brand/popup-loader-config'

/** Timeline frames at 60fps — hold aligns with `POPUP_LOADER.holdFrameFallback`. */
export const PREMIUM_LOADER = {
  fps: 60,
  holdFrame: POPUP_LOADER.holdFrameFallback,
  walkEndFrame: POPUP_LOADER.holdFrameFallback,
  totalFrames: 210,
  characterStartX: 90,
  characterStopX: 498,
  hubX: 620,
} as const

export type LimbPose = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type PremiumLoaderFrame = {
  globalFrame: number
  characterX: number
  characterY: number
  characterOpacity: number
  hubOpacity: number
  doorOpen: number
  phoneGlow: number
  walkPhase: number
  head: { cx: number; cy: number; r: number }
  torso: LimbPose
  leftUpperArm: LimbPose
  leftForearm: LimbPose
  rightUpperArm: LimbPose
  rightForearm: LimbPose
  leftThigh: LimbPose
  leftShin: LimbPose
  rightThigh: LimbPose
  rightShin: LimbPose
  phone: { x: number; y: number; w: number; h: number }
}

type Vec = { x: number; y: number }

function degToRad(value: number) {
  return (value * Math.PI) / 180
}

function limbFromAngle(
  origin: Vec,
  length: number,
  angleDeg: number,
): LimbPose {
  const rad = degToRad(angleDeg)
  return {
    x1: origin.x,
    y1: origin.y,
    x2: origin.x + Math.sin(rad) * length,
    y2: origin.y + Math.cos(rad) * length,
  }
}

function kneeBend(thighAngle: number, forward: boolean) {
  const bend = forward ? 22 : 8
  return thighAngle + (forward ? bend : -bend)
}

function elbowBend(upperAngle: number, forward: boolean) {
  const bend = forward ? 18 : 6
  return upperAngle + (forward ? bend : -bend)
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function computePremiumLoaderFrame(globalFrame: number): PremiumLoaderFrame {
  const {
    walkEndFrame,
    totalFrames,
    characterStartX,
    characterStopX,
  } = PREMIUM_LOADER

  const walkProgress = clamp(globalFrame / walkEndFrame, 0, 1)
  const enterFrame = Math.max(0, globalFrame - walkEndFrame)
  const enterProgress = clamp(enterFrame / (totalFrames - walkEndFrame), 0, 1)

  const characterX =
    characterStartX +
    (characterStopX - characterStartX) * easeInOutCubic(walkProgress) +
    (characterStopX - characterStartX) * 0.08 * easeOutCubic(enterProgress)

  const walkPhase = (globalFrame * 0.14) % 1
  const hipBob = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 4
  const characterY = 368 - hipBob

  const leftLegSwing = Math.sin(walkPhase * Math.PI * 2) * 34
  const rightLegSwing = Math.sin(walkPhase * Math.PI * 2 + Math.PI) * 34
  const leftArmSwing = Math.sin(walkPhase * Math.PI * 2 + Math.PI) * 28
  const rightArmSwing = Math.sin(walkPhase * Math.PI * 2) * 22

  const hip: Vec = { x: characterX, y: characterY }
  const shoulder: Vec = { x: characterX, y: characterY - 28 }

  const leftThigh = limbFromAngle(hip, 20, leftLegSwing)
  const leftShin = limbFromAngle(
    { x: leftThigh.x2, y: leftThigh.y2 },
    18,
    kneeBend(leftLegSwing, leftLegSwing > 0),
  )
  const rightThigh = limbFromAngle(hip, 20, rightLegSwing)
  const rightShin = limbFromAngle(
    { x: rightThigh.x2, y: rightThigh.y2 },
    18,
    kneeBend(rightLegSwing, rightLegSwing > 0),
  )

  const leftUpperArm = limbFromAngle(shoulder, 15, -12 + leftArmSwing)
  const leftForearm = limbFromAngle(
    { x: leftUpperArm.x2, y: leftUpperArm.y2 },
    13,
    elbowBend(-12 + leftArmSwing, leftArmSwing < 0),
  )
  const rightUpperArm = limbFromAngle(shoulder, 15, 18 + rightArmSwing)
  const rightForearm = limbFromAngle(
    { x: rightUpperArm.x2, y: rightUpperArm.y2 },
    13,
    elbowBend(18 + rightArmSwing, rightArmSwing > 0),
  )

  const phone = {
    x: rightForearm.x2 - 4,
    y: rightForearm.y2 - 8,
    w: 9,
    h: 14,
  }

  const hubOpacity = clamp((walkProgress - 0.35) / 0.45, 0, 1)
  const doorOpen =
    globalFrame <= walkEndFrame ? 0 : easeOutCubic(clamp(enterProgress * 1.35, 0, 1))
  const characterOpacity =
    globalFrame <= walkEndFrame
      ? 1
      : 1 - easeOutCubic(clamp((enterProgress - 0.45) / 0.55, 0, 1))

  const phoneGlow = 0.45 + Math.sin(globalFrame * 0.22) * 0.25

  return {
    globalFrame,
    characterX,
    characterY,
    characterOpacity,
    hubOpacity,
    doorOpen,
    phoneGlow,
    walkPhase,
    head: { cx: shoulder.x, cy: shoulder.y - 11, r: 9 },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    leftThigh,
    leftShin,
    rightUpperArm,
    rightForearm,
    rightThigh,
    rightShin,
    phone,
  }
}

export type PremiumLoaderController = {
  destroy: () => void
}

export function createPremiumLoaderController({
  onFrame,
  onReadyToDismiss,
}: {
  onFrame: (frame: PremiumLoaderFrame) => void
  onReadyToDismiss: () => void
}): PremiumLoaderController {
  let destroyed = false
  let pageLoaded = typeof document !== 'undefined' && document.readyState === 'complete'
  let animationComplete = false
  let pausedForLoad = false
  let globalFrame = 0
  let rafId: number | null = null
  let lastTimestamp: number | null = null
  let maxWaitTimer: number | null = null

  const { fps, holdFrame, totalFrames } = PREMIUM_LOADER
  const frameDuration = 1000 / fps

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
        if (globalFrame >= holdFrame && !pageLoaded) {
          globalFrame = holdFrame
          pausedForLoad = true
        }
        if (globalFrame >= totalFrames) {
          animationComplete = true
        }
      }

      onFrame(computePremiumLoaderFrame(globalFrame))
      maybeDismiss()
    }

    if (!animationComplete) {
      rafId = window.requestAnimationFrame(tick)
    }
  }

  onFrame(computePremiumLoaderFrame(0))
  rafId = window.requestAnimationFrame(tick)

  if (!pageLoaded) {
    window.addEventListener('load', onWindowLoad, { once: true })
  }

  maxWaitTimer = window.setTimeout(() => {
    pageLoaded = true
    animationComplete = true
    globalFrame = totalFrames
    onFrame(computePremiumLoaderFrame(totalFrames))
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
