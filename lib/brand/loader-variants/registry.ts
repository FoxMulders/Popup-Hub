import {
  approachMotion,
  baseMarketState,
  buildFamilyPoses,
  buildPhoneCheckFamily,
  clamp,
  dancePose,
  emptyFrame,
  enterMotion,
  easeOutCubic,
  LOADER_LAYOUT,
  LOADER_LAYOUT_COMPUTED,
  ridingPose,
  scooterRidingPose,
  pullingPose,
  type LoaderProp,
  type LoaderSceneFrame,
  walkingPose,
  wavePose,
} from '@/lib/brand/loader-variants/shared'

export type LoaderVariantId =
  | 'walk-to-market'
  | 'skip-hop'
  | 'balloon-drop'
  | 'scooter-cruise'
  | 'market-dance'
  | 'cart-dash'
  | 'puddle-splash'
  | 'parade-wave'
  | 'bike-bell'
  | 'sleepy-stroll'
  | 'confetti-march'

export type LoaderVariant = {
  id: LoaderVariantId
  label: string
  supportsPageLoadHold?: boolean
  computeFrame: (globalFrame: number) => LoaderSceneFrame
}

const { characterStartX, characterStopX, enterFrames, approachFrames, walkPhaseStep, phoneCheckFrames } =
  LOADER_LAYOUT
const baseY = LOADER_LAYOUT_COMPUTED.baseY

function walkPhaseAt(frame: number) {
  return (frame * walkPhaseStep) % 1
}

function finishFrame(
  variantId: LoaderVariantId,
  globalFrame: number,
  approachProgress: number,
  groupX: number,
  members: LoaderSceneFrame['members'],
  extras: Partial<LoaderSceneFrame> = {},
): LoaderSceneFrame {
  if (globalFrame <= approachFrames) {
    const market = baseMarketState(approachProgress, false)
    return emptyFrame({
      variantId,
      globalFrame,
      groupX,
      members,
      walkPhase: walkPhaseAt(globalFrame),
      ...market,
      ...extras,
    })
  }

  const enter = enterMotion(globalFrame, approachFrames, enterFrames, characterStopX)
  const walkPhase = walkPhaseAt(globalFrame)
  const enterMembers = buildFamilyPoses(
    enter.groupX,
    baseY,
    walkPhase,
    (x, y, scale, phase, id) =>
      walkingPose(x, y, scale * enter.groupScale, phase, id),
  )
  const market = baseMarketState(1, false)
  return emptyFrame({
    variantId,
    globalFrame,
    groupX: enter.groupX,
    members: enterMembers,
    groupOpacity: enter.groupOpacity,
    groupScale: enter.groupScale,
    doorOpen: enter.doorOpen,
    walkPhase,
    hubOpacity: market.hubOpacity,
    marketGlow: Math.max(market.marketGlow, extras.marketGlow ?? 0),
    groupYOffset: 0,
    props: enter.doorOpen > 0.25 ? [] : (extras.props ?? []),
  })
}

const walkToMarket: LoaderVariant = {
  id: 'walk-to-market',
  label: 'Walk to market',
  supportsPageLoadHold: true,
  computeFrame(globalFrame) {
    const isPhoneCheck = globalFrame < phoneCheckFrames

    if (isPhoneCheck) {
      const checkProgress = clamp(globalFrame / phoneCheckFrames, 0, 1)
      return emptyFrame({
        variantId: 'walk-to-market',
        globalFrame,
        groupX: characterStartX,
        members: buildPhoneCheckFamily(characterStartX, baseY, checkProgress),
        isPhoneCheck: true,
        phoneGlow: 0.55 + Math.sin(globalFrame * 0.18) * 0.35,
      })
    }

    const walkFrame = globalFrame - phoneCheckFrames
    const approachProgress = clamp(walkFrame / approachFrames, 0, 1)
    const groupX = approachMotion(walkFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(walkFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase, id) =>
      walkingPose(x, y, scale, phase, id),
    )

    if (globalFrame <= phoneCheckFrames + approachFrames) {
      const market = baseMarketState(approachProgress, false)
      return emptyFrame({
        variantId: 'walk-to-market',
        globalFrame,
        groupX,
        members,
        walkPhase,
        phoneGlow: 0.35 + Math.sin(globalFrame * 0.12) * 0.12,
        ...market,
      })
    }

    const enter = enterMotion(
      globalFrame,
      phoneCheckFrames + approachFrames,
      enterFrames,
      characterStopX,
    )
    const enterMembers = buildFamilyPoses(
      enter.groupX,
      baseY,
      walkPhase,
      (x, y, scale, phase, id) =>
        walkingPose(x, y, scale * enter.groupScale, phase, id),
    )
    const market = baseMarketState(1, false)
    return emptyFrame({
      variantId: 'walk-to-market',
      globalFrame,
      groupX: enter.groupX,
      members: enterMembers,
      groupOpacity: enter.groupOpacity,
      groupScale: enter.groupScale,
      doorOpen: enter.doorOpen,
      walkPhase,
      hubOpacity: market.hubOpacity,
      marketGlow: market.marketGlow,
    })
  },
}

const skipHop: LoaderVariant = {
  id: 'skip-hop',
  label: 'Skip & hop',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const hop = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 18
    const members = buildFamilyPoses(
      groupX,
      baseY - hop,
      walkPhase,
      (x, y, scale, phase, id) => walkingPose(x, y, scale, phase, id, 1.45),
    )
    return finishFrame('skip-hop', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      groupYOffset: -hop,
    })
  },
}

const balloonDrop: LoaderVariant = {
  id: 'balloon-drop',
  label: 'Balloon drop',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX =
      approachMotion(globalFrame, approachFrames, characterStartX, characterStopX) +
      Math.sin(globalFrame * walkPhaseStep) * 6
    const dropY = -28 * (1 - easeOutCubic(approachProgress))
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY + dropY, walkPhase, (x, y, scale, phase, id) =>
      walkingPose(x, y, scale, phase, id, 0.7),
    )
    const props: LoaderProp[] = [
      { type: 'balloon', x: groupX - 10, y: baseY + dropY - 55, color: '#f472b6', sway: 0.2 },
      { type: 'balloon', x: groupX - 50, y: baseY + dropY - 48, color: '#38bdf8', sway: 0.35 },
      { type: 'balloon', x: groupX - 78, y: baseY + dropY - 42, color: '#fbbf24', sway: 0.5 },
    ]
    return finishFrame('balloon-drop', globalFrame, approachProgress, groupX, members, {
      groupYOffset: dropY,
      walkPhase,
      props,
    })
  },
}

const scooterCruise: LoaderVariant = {
  id: 'scooter-cruise',
  label: 'Scooter cruise',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX - 20, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase) =>
      scooterRidingPose(x, y, scale, phase),
    )
    const props: LoaderProp[] = members.map((member) => ({
      type: 'scooter',
      x: member.x - 22 * member.scale,
      y: baseY + 6,
      scale: member.scale,
    }))
    return finishFrame('scooter-cruise', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
    })
  },
}

const marketDance: LoaderVariant = {
  id: 'market-dance',
  label: 'Market dance',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const beat = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, beat, (x, y, scale, phase, id) =>
      dancePose(x, y, scale, phase, id),
    )
    const props: LoaderProp[] = [
      { type: 'note', x: groupX - 20, y: baseY - 70, opacity: 0.5 + Math.sin(globalFrame * walkPhaseStep * 5) * 0.3 },
      { type: 'note', x: groupX - 55, y: baseY - 85, opacity: 0.4 + Math.sin(globalFrame * walkPhaseStep * 5 + 1) * 0.3 },
    ]
    return finishFrame('market-dance', globalFrame, approachProgress, groupX, members, {
      walkPhase: beat,
      props,
      marketGlow: approachProgress * 0.8,
    })
  },
}

const cartDash: LoaderVariant = {
  id: 'cart-dash',
  label: 'Cart dash',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase, id) =>
      pullingPose(x, y, scale, phase, id),
    )
    const props: LoaderProp[] = [{ type: 'cart', x: groupX - 118, y: baseY + 4 }]
    return finishFrame('cart-dash', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
    })
  },
}

const puddleSplash: LoaderVariant = {
  id: 'puddle-splash',
  label: 'Puddle splash',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase, id) =>
      walkingPose(x, y, scale, phase, id, 1.25),
    )
    const splashFrame = Math.floor(walkPhase * 6)
    const props: LoaderProp[] = [
      { type: 'splash', x: groupX - 30 + splashFrame * 8, y: baseY + 10, r: 14, opacity: 0.55 },
      { type: 'splash', x: groupX - 55 + splashFrame * 6, y: baseY + 12, r: 10, opacity: 0.4 },
    ]
    return finishFrame('puddle-splash', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
    })
  },
}

const paradeWave: LoaderVariant = {
  id: 'parade-wave',
  label: 'Parade wave',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase, id) =>
      wavePose(x, y, scale, phase, id),
    )
    return finishFrame('parade-wave', globalFrame, approachProgress, groupX, members, {
      walkPhase,
    })
  },
}

const bikeBell: LoaderVariant = {
  id: 'bike-bell',
  label: 'Bike arrival',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX - 10, characterStopX - 10)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase) =>
      ridingPose(x, y, scale, phase),
    )
    const props: LoaderProp[] = members.map((member) => ({
      type: 'bike',
      x: member.x - 20 * member.scale,
      y: baseY + 2,
      scale: member.scale,
    }))
    return finishFrame('bike-bell', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
    })
  },
}

const sleepyStroll: LoaderVariant = {
  id: 'sleepy-stroll',
  label: 'Sleepy stroll',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const yawn = Math.max(0, Math.sin(globalFrame * walkPhaseStep)) > 0.92 ? 8 : 0
    const members = buildFamilyPoses(
      groupX,
      baseY,
      walkPhase,
      (x, y, scale, phase, id) => {
        const pose = walkingPose(x, y, scale, phase, id, 0.55)
        if (id === 'lead' && yawn > 0) {
          return {
            ...pose,
            head: { ...pose.head, cy: pose.head.cy - 4 * scale, r: pose.head.r * 1.05 },
          }
        }
        return pose
      },
    )
    const props: LoaderProp[] = yawn
      ? [{ type: 'zzz', x: groupX - 8, y: baseY - 55, opacity: 0.7 }]
      : []
    return finishFrame('sleepy-stroll', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
    })
  },
}

const confettiMarch: LoaderVariant = {
  id: 'confetti-march',
  label: 'Confetti march',
  computeFrame(globalFrame) {
    const approachProgress = clamp(globalFrame / approachFrames, 0, 1)
    const groupX = approachMotion(globalFrame, approachFrames, characterStartX, characterStopX)
    const walkPhase = walkPhaseAt(globalFrame)
    const members = buildFamilyPoses(groupX, baseY, walkPhase, (x, y, scale, phase, id) =>
      walkingPose(x, y, scale, phase, id, 1.15),
    )
    const colors = ['#f472b6', '#38bdf8', '#fbbf24', '#7b9b52', '#c4892e']
    const props: LoaderProp[] = Array.from({ length: 12 }, (_, i) => ({
      type: 'confetti' as const,
      x: 120 + i * 52 + Math.sin(globalFrame * walkPhaseStep + i) * 20,
      y: 80 + ((globalFrame * 1.2 + i * 30) % 220),
      color: colors[i % colors.length]!,
      rotation: (globalFrame * 2 + i * 40) % 360,
      opacity: 0.55 + (i % 3) * 0.12,
    }))
    return finishFrame('confetti-march', globalFrame, approachProgress, groupX, members, {
      walkPhase,
      props,
      marketGlow: 0.5 + approachProgress * 0.5,
    })
  },
}

export const LOADER_VARIANTS: Record<LoaderVariantId, LoaderVariant> = {
  'walk-to-market': walkToMarket,
  'skip-hop': skipHop,
  'balloon-drop': balloonDrop,
  'scooter-cruise': scooterCruise,
  'market-dance': marketDance,
  'cart-dash': cartDash,
  'puddle-splash': puddleSplash,
  'parade-wave': paradeWave,
  'bike-bell': bikeBell,
  'sleepy-stroll': sleepyStroll,
  'confetti-march': confettiMarch,
}

export const LOADER_VARIANT_IDS = Object.keys(LOADER_VARIANTS) as LoaderVariantId[]

/** Logo-click replays — never repeat the initial page-load animation. */
export const LOADER_REPLAY_VARIANT_IDS = LOADER_VARIANT_IDS.filter(
  (id) => id !== 'walk-to-market',
) as LoaderVariantId[]

export function pickRandomLoaderVariant(options?: { forReplay?: boolean }): LoaderVariantId {
  const pool = options?.forReplay ? LOADER_REPLAY_VARIANT_IDS : LOADER_VARIANT_IDS
  return pool[Math.floor(Math.random() * pool.length)]!
}

export function getVariantTotalFrames(variant: LoaderVariant): number {
  const approachEnd =
    LOADER_LAYOUT.approachFrames + (variant.supportsPageLoadHold ? LOADER_LAYOUT.phoneCheckFrames : 0)
  return approachEnd + LOADER_LAYOUT.enterFrames
}

export function getVariantHoldFrame(variant: LoaderVariant): number | null {
  if (!variant.supportsPageLoadHold) return null
  return LOADER_LAYOUT.phoneCheckFrames + LOADER_LAYOUT.approachFrames
}

export function computeVariantFrame(variantId: LoaderVariantId, globalFrame: number): LoaderSceneFrame {
  return LOADER_VARIANTS[variantId].computeFrame(globalFrame)
}
