/** Shared layout + pose math for Popup Hub loader variants. */
export const LOGO_NATURAL_WIDTH = 1024
export const LOGO_NATURAL_HEIGHT = 559
export const LOGO_ASPECT = LOGO_NATURAL_HEIGHT / LOGO_NATURAL_WIDTH

export const LOADER_LAYOUT = {
  fps: 60,
  sidewalkY: 408,
  /** Walkway surface — logo ground line sits here. */
  logoBottomY: 410,
  characterStartX: 72,
  characterStopX: 288,
  hubX: 532,
  /** Wide wordmark — height derived from true aspect ratio (no letterboxing). */
  logoWidth: 440,
  logoHeight: Math.round(440 * LOGO_ASPECT),
  /** Pin center as fraction of rendered logo height (matches PNG artwork). */
  pinOffsetY: 0.3,
  pinScale: 440 / 250,
  /** All variants use the slowest timing (sleepy-stroll). */
  approachFrames: 420,
  walkPhaseStep: 0.035,
  phoneCheckFrames: 110,
  enterFrames: 100,
  /** Sidewalk X where the lead character steps into the pin doorway. */
  doorThresholdX: 496,
} as const

export const LOADER_LAYOUT_COMPUTED = {
  get logoTop() {
    return LOADER_LAYOUT.logoBottomY - LOADER_LAYOUT.logoHeight
  },
  get pinCenterX() {
    return LOADER_LAYOUT.hubX
  },
  get pinCenterY() {
    return LOADER_LAYOUT_COMPUTED.logoTop + LOADER_LAYOUT.logoHeight * LOADER_LAYOUT.pinOffsetY
  },
  get logoLeft() {
    return LOADER_LAYOUT.hubX - LOADER_LAYOUT.logoWidth / 2
  },
  get baseY() {
    return LOADER_LAYOUT.sidewalkY - 16
  },
} as const

export type LimbPose = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type CharacterPose = {
  id: 'lead' | 'partner' | 'child'
  x: number
  y: number
  scale: number
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
  phone?: { x: number; y: number; w: number; h: number }
}

export type LoaderProp =
  | { type: 'balloon'; x: number; y: number; color: string; sway: number }
  | { type: 'scooter'; x: number; y: number; scale?: number }
  | { type: 'cart'; x: number; y: number }
  | { type: 'bike'; x: number; y: number; scale?: number }
  | { type: 'splash'; x: number; y: number; r: number; opacity: number }
  | { type: 'confetti'; x: number; y: number; color: string; rotation: number; opacity: number }
  | { type: 'note'; x: number; y: number; opacity: number }
  | { type: 'zzz'; x: number; y: number; opacity: number }

export type LoaderSceneFrame = {
  globalFrame: number
  variantId: string
  groupX: number
  groupYOffset: number
  members: CharacterPose[]
  groupOpacity: number
  /** Depth scale while walking into the storefront (1 = full size). */
  groupScale: number
  hubOpacity: number
  marketGlow: number
  doorOpen: number
  phoneGlow: number
  walkPhase: number
  isPhoneCheck: boolean
  props: LoaderProp[]
}

type Vec = { x: number; y: number }

type MemberSpec = {
  id: CharacterPose['id']
  xOffset: number
  yOffset: number
  scale: number
  walkPhaseOffset: number
  hasPhone?: boolean
}

export const FAMILY: MemberSpec[] = [
  { id: 'lead', xOffset: 0, yOffset: 0, scale: 1, walkPhaseOffset: 0, hasPhone: true },
  { id: 'partner', xOffset: -36, yOffset: 3, scale: 0.94, walkPhaseOffset: 0.5 },
  { id: 'child', xOffset: -68, yOffset: 16, scale: 0.58, walkPhaseOffset: 0.28 },
]

export function degToRad(value: number) {
  return (value * Math.PI) / 180
}

export function limbFromAngle(origin: Vec, length: number, angleDeg: number): LimbPose {
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

export function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

export function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value ** 3 : 1 - (-2 * value + 2) ** 3 / 2
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function standingLegs(hip: Vec, scale: number) {
  const leftThigh = limbFromAngle(hip, 20 * scale, 10)
  const leftShin = limbFromAngle({ x: leftThigh.x2, y: leftThigh.y2 }, 18 * scale, 4)
  const rightThigh = limbFromAngle(hip, 20 * scale, -10)
  const rightShin = limbFromAngle({ x: rightThigh.x2, y: rightThigh.y2 }, 18 * scale, -4)
  return { leftThigh, leftShin, rightThigh, rightShin }
}

export function phoneCheckPose(
  characterX: number,
  characterY: number,
  scale: number,
  checkProgress: number,
  hasPhone: boolean,
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const raiseT = clamp(checkProgress / 0.35, 0, 1)
  const lookT = clamp((checkProgress - 0.25) / 0.55, 0, 1)
  const prepWalkT = clamp((checkProgress - 0.82) / 0.18, 0, 1)

  const hip: Vec = { x: characterX, y: characterY }
  const shoulder: Vec = { x: characterX, y: characterY - 28 * scale }
  const headDrop = (3 + lookT * 5 - prepWalkT * 2) * scale
  const headForward = (lookT * 4 - prepWalkT * 2) * scale

  const { leftThigh, leftShin, rightThigh, rightShin } = standingLegs(hip, scale)

  let leftUpperArm = limbFromAngle(shoulder, 15 * scale, -8 - raiseT * 4)
  let leftForearm = limbFromAngle(
    { x: leftUpperArm.x2, y: leftUpperArm.y2 },
    13 * scale,
    elbowBend(-8, false),
  )
  let rightUpperArm = limbFromAngle(shoulder, 15 * scale, 8 + raiseT * 4)
  let rightForearm = limbFromAngle(
    { x: rightUpperArm.x2, y: rightUpperArm.y2 },
    13 * scale,
    elbowBend(8, true),
  )
  let phone: CharacterPose['phone']

  if (hasPhone) {
    const phoneArmAngle = -18 + raiseT * 52 - prepWalkT * 18
    const phoneForearmAngle = 38 + raiseT * 48 - prepWalkT * 22
    rightUpperArm = limbFromAngle(shoulder, 15 * scale, phoneArmAngle)
    rightForearm = limbFromAngle(
      { x: rightUpperArm.x2, y: rightUpperArm.y2 },
      13 * scale,
      phoneForearmAngle,
    )
    phone = {
      x: rightForearm.x2 - 5 * scale + headForward * 0.3,
      y: rightForearm.y2 - 10 * scale + headDrop * 0.4,
      w: 10 * scale,
      h: 16 * scale,
    }
  } else {
    const glance = lookT * 6
    leftUpperArm = limbFromAngle(shoulder, 15 * scale, -18 + glance)
    leftForearm = limbFromAngle(
      { x: leftUpperArm.x2, y: leftUpperArm.y2 },
      13 * scale,
      elbowBend(-18 + glance, true),
    )
    rightUpperArm = limbFromAngle(shoulder, 15 * scale, 14 - glance * 0.5)
    rightForearm = limbFromAngle(
      { x: rightUpperArm.x2, y: rightUpperArm.y2 },
      13 * scale,
      elbowBend(14, false),
    )
  }

  return {
    head: { cx: shoulder.x + headForward, cy: shoulder.y - 9 * scale + headDrop, r: 9 * scale },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin,
    phone,
  }
}

export function walkingPose(
  characterX: number,
  characterY: number,
  scale: number,
  walkPhase: number,
  id: CharacterPose['id'],
  intensity = 1,
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const hipBob = Math.abs(Math.sin(walkPhase * Math.PI * 2)) * 3 * scale * intensity
  const y = characterY - hipBob

  const legMul = 28 * intensity
  const armMul = id === 'child' ? 16 * intensity : 22 * intensity
  const rightArmMul = id === 'child' ? 14 * intensity : 18 * intensity

  const leftLegSwing = Math.sin(walkPhase * Math.PI * 2) * legMul
  const rightLegSwing = Math.sin(walkPhase * Math.PI * 2 + Math.PI) * legMul
  const leftArmSwing = Math.sin(walkPhase * Math.PI * 2 + Math.PI) * armMul
  const rightArmSwing = Math.sin(walkPhase * Math.PI * 2) * rightArmMul

  const hip: Vec = { x: characterX, y }
  const shoulder: Vec = { x: characterX, y: y - 28 * scale }

  const leftThigh = limbFromAngle(hip, 20 * scale, leftLegSwing)
  const leftShin = limbFromAngle(
    { x: leftThigh.x2, y: leftThigh.y2 },
    18 * scale,
    kneeBend(leftLegSwing, leftLegSwing > 0),
  )
  const rightThigh = limbFromAngle(hip, 20 * scale, rightLegSwing)
  const rightShin = limbFromAngle(
    { x: rightThigh.x2, y: rightThigh.y2 },
    18 * scale,
    kneeBend(rightLegSwing, rightLegSwing > 0),
  )

  const leftUpperArm = limbFromAngle(shoulder, 15 * scale, -12 + leftArmSwing)
  const leftForearm = limbFromAngle(
    { x: leftUpperArm.x2, y: leftUpperArm.y2 },
    13 * scale,
    elbowBend(-12 + leftArmSwing, leftArmSwing < 0),
  )
  const rightUpperArm = limbFromAngle(shoulder, 15 * scale, 16 + rightArmSwing)
  const rightForearm = limbFromAngle(
    { x: rightUpperArm.x2, y: rightUpperArm.y2 },
    13 * scale,
    elbowBend(16 + rightArmSwing, rightArmSwing > 0),
  )

  return {
    head: { cx: shoulder.x, cy: shoulder.y - 11 * scale, r: 9 * scale },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin,
  }
}

export function dancePose(
  characterX: number,
  characterY: number,
  scale: number,
  beat: number,
  id: CharacterPose['id'],
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const bounce = Math.abs(Math.sin(beat * Math.PI * 2)) * 8 * scale
  const hip: Vec = { x: characterX, y: characterY - bounce }
  const shoulder: Vec = { x: characterX, y: hip.y - 28 * scale }
  const sway = Math.sin(beat * Math.PI * 2) * 15

  const { leftThigh, leftShin, rightThigh, rightShin } = standingLegs(hip, scale)
  const armLift = id === 'child' ? 55 : 68

  const leftUpperArm = limbFromAngle(shoulder, 15 * scale, -armLift + sway * 0.4)
  const leftForearm = limbFromAngle(
    { x: leftUpperArm.x2, y: leftUpperArm.y2 },
    13 * scale,
    -armLift + 20,
  )
  const rightUpperArm = limbFromAngle(shoulder, 15 * scale, armLift - sway * 0.4)
  const rightForearm = limbFromAngle(
    { x: rightUpperArm.x2, y: rightUpperArm.y2 },
    13 * scale,
    armLift - 20,
  )

  return {
    head: { cx: shoulder.x, cy: shoulder.y - 11 * scale, r: 9 * scale },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin,
  }
}

export function wavePose(
  characterX: number,
  characterY: number,
  scale: number,
  walkPhase: number,
  id: CharacterPose['id'],
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const base = walkingPose(characterX, characterY, scale, walkPhase, id, 0.85)
  if (id === 'lead' || id === 'child') {
    const wave = Math.sin(walkPhase * Math.PI * 4) * 18
    const shoulder = { x: characterX, y: characterY - 28 * scale }
    const rightUpperArm = limbFromAngle(shoulder, 15 * scale, -75 + wave)
    const rightForearm = limbFromAngle(
      { x: rightUpperArm.x2, y: rightUpperArm.y2 },
      13 * scale,
      -95 + wave,
    )
    return { ...base, rightUpperArm, rightForearm }
  }
  return base
}

/** Seated on a bike — arms on handlebars, legs pedaling. */
export function ridingPose(
  characterX: number,
  characterY: number,
  scale: number,
  walkPhase: number,
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const pedal = Math.sin(walkPhase * Math.PI * 2) * 22
  const hip: Vec = { x: characterX, y: characterY - 10 * scale }
  const shoulder: Vec = { x: characterX, y: hip.y - 24 * scale }

  const leftThigh = limbFromAngle(hip, 17 * scale, 38 + pedal)
  const leftShin = limbFromAngle({ x: leftThigh.x2, y: leftThigh.y2 }, 15 * scale, 68 + pedal * 0.6)
  const rightThigh = limbFromAngle(hip, 17 * scale, 38 - pedal)
  const rightShin = limbFromAngle({ x: rightThigh.x2, y: rightThigh.y2 }, 15 * scale, 68 - pedal * 0.6)

  const leftUpperArm = limbFromAngle(shoulder, 14 * scale, -32)
  const leftForearm = limbFromAngle({ x: leftUpperArm.x2, y: leftUpperArm.y2 }, 12 * scale, -8)
  const rightUpperArm = limbFromAngle(shoulder, 14 * scale, -22)
  const rightForearm = limbFromAngle({ x: rightUpperArm.x2, y: rightUpperArm.y2 }, 12 * scale, 2)

  return {
    head: { cx: shoulder.x, cy: shoulder.y - 10 * scale, r: 9 * scale },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin,
  }
}

/** Standing on a scooter deck. */
export function scooterRidingPose(
  characterX: number,
  characterY: number,
  scale: number,
  walkPhase: number,
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const sway = Math.sin(walkPhase * Math.PI * 2) * 4
  const hip: Vec = { x: characterX, y: characterY - 6 * scale }
  const shoulder: Vec = { x: characterX, y: hip.y - 26 * scale }

  const leftThigh = limbFromAngle(hip, 18 * scale, 12 + sway)
  const leftShin = limbFromAngle({ x: leftThigh.x2, y: leftThigh.y2 }, 16 * scale, 8)
  const rightThigh = limbFromAngle(hip, 18 * scale, -8 - sway)
  const rightShin = limbFromAngle({ x: rightThigh.x2, y: rightThigh.y2 }, 16 * scale, -12)

  const leftUpperArm = limbFromAngle(shoulder, 14 * scale, -28)
  const leftForearm = limbFromAngle({ x: leftUpperArm.x2, y: leftUpperArm.y2 }, 12 * scale, -5)
  const rightUpperArm = limbFromAngle(shoulder, 14 * scale, -18)
  const rightForearm = limbFromAngle({ x: rightUpperArm.x2, y: rightUpperArm.y2 }, 12 * scale, 5)

  return {
    head: { cx: shoulder.x, cy: shoulder.y - 11 * scale, r: 9 * scale },
    torso: { x1: shoulder.x, y1: shoulder.y, x2: hip.x, y2: hip.y },
    leftUpperArm,
    leftForearm,
    rightUpperArm,
    rightForearm,
    leftThigh,
    leftShin,
    rightThigh,
    rightShin,
  }
}

/** Lead adult pulls a wagon behind the group. */
export function pullingPose(
  characterX: number,
  characterY: number,
  scale: number,
  walkPhase: number,
  id: CharacterPose['id'],
): Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'> {
  const base = walkingPose(characterX, characterY, scale, walkPhase, id, 0.85)
  if (id !== 'lead') return base

  const shoulder = { x: characterX, y: base.torso.y1 }
  const pullSwing = Math.sin(walkPhase * Math.PI * 2) * 6
  const leftUpperArm = limbFromAngle(shoulder, 15 * scale, 42 + pullSwing)
  const leftForearm = limbFromAngle({ x: leftUpperArm.x2, y: leftUpperArm.y2 }, 13 * scale, 62 + pullSwing)
  const rightUpperArm = limbFromAngle(shoulder, 15 * scale, 52 - pullSwing)
  const rightForearm = limbFromAngle({ x: rightUpperArm.x2, y: rightUpperArm.y2 }, 13 * scale, 72 - pullSwing)

  return { ...base, leftUpperArm, leftForearm, rightUpperArm, rightForearm }
}

export function buildFamilyPoses(
  groupX: number,
  baseY: number,
  walkPhase: number,
  poseFn: (
    x: number,
    y: number,
    scale: number,
    phase: number,
    id: CharacterPose['id'],
    member: MemberSpec,
  ) => Omit<CharacterPose, 'id' | 'x' | 'y' | 'scale'>,
  offsets?: Partial<Record<CharacterPose['id'], { x?: number; y?: number }>>,
): CharacterPose[] {
  return FAMILY.map((member) => {
    const extra = offsets?.[member.id]
    const x = groupX + member.xOffset + (extra?.x ?? 0)
    const y = baseY + member.yOffset + (extra?.y ?? 0)
    const phase = (walkPhase + member.walkPhaseOffset) % 1
    const body = poseFn(x, y, member.scale, phase, member.id, member)
    return { id: member.id, x, y, scale: member.scale, ...body }
  })
}

export function buildPhoneCheckFamily(
  groupX: number,
  baseY: number,
  checkProgress: number,
): CharacterPose[] {
  return FAMILY.map((member) => {
    const x = groupX + member.xOffset
    const y = baseY + member.yOffset
    const body = phoneCheckPose(x, y, member.scale, checkProgress, Boolean(member.hasPhone))
    return { id: member.id, x, y, scale: member.scale, ...body }
  })
}

export function approachMotion(
  globalFrame: number,
  approachFrames: number,
  startX: number,
  stopX: number,
) {
  const t = clamp(globalFrame / approachFrames, 0, 1)
  return startX + (stopX - startX) * easeInOutCubic(t)
}

/** Share of enter timeline spent walking to the door before any fade. */
const ENTER_WALK_PORTION = 0.9

export function enterMotion(
  globalFrame: number,
  approachEnd: number,
  enterFrames: number,
  stopX: number,
) {
  const enterFrame = Math.max(0, globalFrame - approachEnd)
  const t = clamp(enterFrame / enterFrames, 0, 1)
  const walkPhaseT = clamp(t / ENTER_WALK_PORTION, 0, 1)
  const walkT = easeInOutCubic(walkPhaseT)
  const doorX = LOADER_LAYOUT.doorThresholdX
  const groupX = stopX + (doorX - stopX) * walkT
  const doorOpen = easeOutCubic(clamp(walkPhaseT * 1.3, 0, 1))
  const groupScale = 1 - walkT * 0.12
  const fadeT =
    t <= ENTER_WALK_PORTION
      ? 0
      : clamp((t - ENTER_WALK_PORTION) / (1 - ENTER_WALK_PORTION), 0, 1)
  const groupOpacity = 1 - easeOutCubic(fadeT)
  return {
    groupX,
    doorOpen,
    groupOpacity,
    groupScale,
  }
}

export function baseMarketState(approachProgress: number, isPhoneCheck: boolean) {
  return {
    hubOpacity: isPhoneCheck ? 0 : clamp((approachProgress - 0.12) / 0.5, 0, 1),
    marketGlow: isPhoneCheck ? 0 : clamp((approachProgress - 0.3) / 0.55, 0, 1),
  }
}

export function emptyFrame(partial: Partial<LoaderSceneFrame> & Pick<LoaderSceneFrame, 'variantId' | 'globalFrame'>): LoaderSceneFrame {
  return {
    groupX: LOADER_LAYOUT.characterStartX,
    groupYOffset: 0,
    members: [],
    groupOpacity: 1,
    groupScale: 1,
    hubOpacity: 0,
    marketGlow: 0,
    doorOpen: 0,
    phoneGlow: 0,
    walkPhase: 0,
    isPhoneCheck: false,
    props: [],
    ...partial,
  }
}
