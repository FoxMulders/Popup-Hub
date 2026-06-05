'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createLoaderController,
  computeVariantFrame,
  type LoaderControllerMode,
  type LoaderVariantId,
} from '@/lib/brand/loader-variants'
import {
  LOADER_LAYOUT,
  LOADER_LAYOUT_COMPUTED,
  type CharacterPose,
  type LoaderProp,
  type LoaderSceneFrame,
} from '@/lib/brand/loader-variants/shared'

function frameForMode(frame: LoaderSceneFrame, mode: LoaderControllerMode): LoaderSceneFrame {
  if (mode !== 'replay') return frame
  return {
    ...frame,
    hubOpacity: Math.max(frame.hubOpacity, 0.92),
    marketGlow: Math.max(frame.marketGlow, 0.55),
  }
}

/**
 * Storefront-only artwork. The wordmark used to be baked into the same
 * PNG (`/popup-hub-logo.png`) which forced the "Popup Hub" text into
 * the bottom 30 % of the rendered logo box, lifting the market icon
 * off the sidewalk and crashing the typography into the walking
 * characters. Switching to the square icon decouples the two so the
 * market sits flush on the ground and the wordmark renders separately
 * as SVG `<text>` above the canvas.
 */
const LOGO_SRC = '/popup-hub-icon.png'

/**
 * Brand wordmark frame — drawn directly in the SVG above the walking
 * canvas. Pinned to the absolute top of the viewport so the typography
 * cannot drift into the storefront / characters / sidewalk band below.
 *
 * `dominantBaseline="hanging"` means `WORDMARK_Y` is the *top* of the
 * letters (ascender line), not the visual middle, so we land cleanly
 * a few units inside the viewBox top edge instead of clipping the
 * cap-height. The viewBox itself is extended upward (see the outer
 * `<svg viewBox>` below) to guarantee there is always breathing room
 * above the wordmark and above the market tent peak, even when the
 * container wrapper is short relative to the SVG's 4:3 aspect.
 */
const WORDMARK_TEXT = 'Popup Hub'
const WORDMARK_Y = 12
const WORDMARK_FONT_SIZE = 64
const WORDMARK_LETTER_SPACING = 2
const WORDMARK_FILL = '#2d5a27'

/**
 * Continuous phone-flash oscillation. The lead character's phone glows
 * with a steady sine pulse for the entire animation lifetime — no
 * iteration cap, no end-of-phase termination — so the screen "blinks"
 * forever the way a real notification light would. Driven off
 * `globalFrame` so the loop period is independent of FPS hiccups.
 */
function continuousPhoneGlow(globalFrame: number): number {
  return 0.55 + Math.sin(globalFrame * 0.18) * 0.4
}

const SCENE_PROP_TYPES = new Set(['balloon', 'splash', 'confetti', 'note', 'zzz'])
const VEHICLE_PROP_TYPES = new Set(['bike', 'scooter', 'cart'])

function isSceneProp(prop: LoaderProp) {
  return SCENE_PROP_TYPES.has(prop.type)
}

function isVehicleProp(prop: LoaderProp) {
  return VEHICLE_PROP_TYPES.has(prop.type)
}

const PIN_PATH =
  'M 0 -34 C 18 -34 30 -20 30 -4 C 30 10 0 42 0 42 C 0 42 -30 10 -30 -4 C -30 -20 -18 -34 0 -34 Z M 0 -14 C -8 -14 -14 -8 -14 0 C -14 8 -8 14 0 14 C 8 14 14 8 14 0 C 14 -8 8 -14 0 -14 Z'

function Limb({
  pose,
  strokeWidth = 3.5,
}: {
  pose: CharacterPose['torso']
  strokeWidth?: number
}) {
  return (
    <line
      x1={pose.x1}
      y1={pose.y1}
      x2={pose.x2}
      y2={pose.y2}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  )
}

function StickFigure({
  member,
  frame,
}: {
  member: CharacterPose
  frame: LoaderSceneFrame
}) {
  const sw = 3 * member.scale
  const legSw = 3.5 * member.scale

  return (
    <g>
      <Limb pose={member.torso} strokeWidth={sw + 0.5} />
      <Limb pose={member.leftUpperArm} strokeWidth={sw} />
      <Limb pose={member.leftForearm} strokeWidth={sw} />
      <Limb pose={member.rightUpperArm} strokeWidth={sw} />
      <Limb pose={member.rightForearm} strokeWidth={sw} />
      <Limb pose={member.leftThigh} strokeWidth={legSw} />
      <Limb pose={member.leftShin} strokeWidth={legSw} />
      <Limb pose={member.rightThigh} strokeWidth={legSw} />
      <Limb pose={member.rightShin} strokeWidth={legSw} />
      <circle
        cx={member.head.cx}
        cy={member.head.cy}
        r={member.head.r}
        fill="#000000"
        stroke="#000000"
        strokeWidth={1.5 * member.scale}
      />
      {member.phone ? (
        // Phone glow runs as a perpetual sine loop. Previously the
        // outer-group opacity tracked `frame.phoneGlow`, which was 0
        // for every replay variant (only the initial `walk-to-market`
        // populated it during its phone-check phase). Driving opacity
        // off `continuousPhoneGlow(globalFrame)` instead makes the
        // notification flash run for the entire lifetime of every
        // variant, with zero iteration cap.
        <g
          filter="url(#premium-loader-phone-glow)"
          opacity={continuousPhoneGlow(frame.globalFrame)}
        >
          <rect
            x={member.phone.x}
            y={member.phone.y}
            width={member.phone.w}
            height={member.phone.h}
            rx={2 * member.scale}
            fill="#38bdf8"
            stroke="#7dd3fc"
            strokeWidth={1}
          />
          <rect
            x={member.phone.x + 2 * member.scale}
            y={member.phone.y + 3 * member.scale}
            width={member.phone.w - 4 * member.scale}
            height={member.phone.h - 6 * member.scale}
            rx={member.scale}
            fill="#0ea5e9"
            opacity={0.85}
          />
          {/* Inner notification flash — also driven off globalFrame
              so the "screen woke up" highlight pulses forever, not
              just during the phone-check intro. */}
          <rect
            x={member.phone.x + 3 * member.scale}
            y={member.phone.y + 5 * member.scale}
            width={member.phone.w - 6 * member.scale}
            height={member.phone.h - 10 * member.scale}
            rx={member.scale}
            fill="#bae6fd"
            opacity={0.35 + Math.sin(frame.globalFrame * 0.2) * 0.25}
          />
        </g>
      ) : null}
    </g>
  )
}

function LoaderPropGraphic({ prop }: { prop: LoaderProp }) {
  switch (prop.type) {
    case 'balloon':
      return (
        <g transform={`translate(${prop.x}, ${prop.y + Math.sin(prop.sway * 20) * 4})`}>
          <line x1="0" y1="0" x2="0" y2="28" stroke="#94a3b8" strokeWidth="1.5" />
          <ellipse cx="0" cy="0" rx="10" ry="13" fill={prop.color} opacity="0.85" />
        </g>
      )
    case 'scooter': {
      const s = prop.scale ?? 1
      return (
        <g transform={`translate(${prop.x}, ${prop.y}) scale(${s})`}>
          <rect x="0" y="8" width="52" height="6" rx="3" fill="#64748b" />
          <circle cx="10" cy="18" r="7" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <circle cx="42" cy="18" r="7" fill="#334155" stroke="#64748b" strokeWidth="2" />
          <rect x="36" y="0" width="4" height="16" rx="2" fill="#94a3b8" />
        </g>
      )
    }
    case 'cart':
      return (
        <g transform={`translate(${prop.x}, ${prop.y})`}>
          <rect x="0" y="6" width="44" height="22" rx="4" fill="#475569" stroke="#64748b" strokeWidth="1.5" />
          <circle cx="11" cy="32" r="5" fill="#334155" />
          <circle cx="33" cy="32" r="5" fill="#334155" />
          <line x1="44" y1="16" x2="62" y2="16" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
          <line x1="62" y1="16" x2="72" y2="16" stroke="#cbd5e1" strokeWidth="2" strokeLinecap="round" />
        </g>
      )
    case 'bike': {
      const s = prop.scale ?? 1
      return (
        <g transform={`translate(${prop.x}, ${prop.y}) scale(${s})`}>
          <circle cx="12" cy="22" r="11" fill="none" stroke="#64748b" strokeWidth="2.5" />
          <circle cx="48" cy="22" r="11" fill="none" stroke="#64748b" strokeWidth="2.5" />
          <path d="M 12 22 L 28 8 L 38 22 L 48 22" fill="none" stroke="#94a3b8" strokeWidth="2.5" />
          <rect x="24" y="4" width="4" height="10" rx="2" fill="#64748b" />
        </g>
      )
    }
    case 'splash':
      return (
        <g opacity={prop.opacity}>
          <ellipse cx={prop.x} cy={prop.y} rx={prop.r} ry={prop.r * 0.35} fill="#38bdf8" opacity="0.45" />
          {[-8, 0, 8].map((dx) => (
            <circle key={dx} cx={prop.x + dx} cy={prop.y - 8} r="2.5" fill="#7dd3fc" />
          ))}
        </g>
      )
    case 'confetti':
      return (
        <rect
          x={prop.x}
          y={prop.y}
          width="6"
          height="10"
          rx="1"
          fill={prop.color}
          opacity={prop.opacity}
          transform={`rotate(${prop.rotation} ${prop.x + 3} ${prop.y + 5})`}
        />
      )
    case 'note':
      return (
        <text x={prop.x} y={prop.y} fill="#fbbf24" fontSize="22" opacity={prop.opacity}>
          ♪
        </text>
      )
    case 'zzz':
      return (
        <text x={prop.x} y={prop.y} fill="#94a3b8" fontSize="18" fontWeight="600" opacity={prop.opacity}>
          z z z
        </text>
      )
    default:
      return null
  }
}

function MarketLights({
  hubX,
  logoTop,
  logoWidth,
  glow,
}: {
  hubX: number
  logoTop: number
  logoWidth: number
  glow: number
}) {
  const span = logoWidth * 0.48
  const bulbs = [-1, -0.65, -0.3, 0.05, 0.4, 0.75, 1]
  return (
    <g opacity={0.35 + glow * 0.65}>
      <path
        d={`M ${hubX - span} ${logoTop - 14} Q ${hubX} ${logoTop - 40} ${hubX + span} ${logoTop - 14}`}
        fill="none"
        stroke="#64748b"
        strokeWidth="2"
      />
      {bulbs.map((t, index) => {
        const x = hubX - span + ((t + 1) / 2) * span * 2
        const y = logoTop - 14 - Math.sin(((t + 1) / 2) * Math.PI) * 22
        const warm = index % 2 === 0 ? '#fbbf24' : '#f59e0b'
        return (
          <g key={t}>
            <circle cx={x} cy={y} r={5} fill={warm} opacity={0.25 + glow * 0.55} />
            <circle cx={x} cy={y} r={2.5} fill="#fef3c7" opacity={0.7 + glow * 0.3} />
          </g>
        )
      })}
    </g>
  )
}

function LoaderSceneSvg({ frame }: { frame: LoaderSceneFrame }) {
  const { hubX, logoWidth, logoHeight, sidewalkY, logoBottomY, pinScale } = LOADER_LAYOUT
  const { logoTop, logoLeft, pinCenterX, pinCenterY } = LOADER_LAYOUT_COMPUTED
  const pinOpenAngle = frame.doorOpen * -28
  const pinDoorScale = (1 - frame.doorOpen * 0.12) * pinScale
  const leadMember = frame.members[0]
  const footAnchorX = leadMember?.x ?? frame.groupX
  const footAnchorY = sidewalkY
  const depthScale = frame.groupScale ?? 1
  const depthTransform =
    depthScale === 1
      ? `translate(0, ${frame.groupYOffset})`
      : `translate(${footAnchorX}, ${footAnchorY}) scale(${depthScale}) translate(${-footAnchorX}, ${-footAnchorY}) translate(0, ${frame.groupYOffset})`

  return (
    // viewBox is extended *upward* by 80 units (min-y = -80, height = 680)
    // so the wordmark and the tent peak both have guaranteed headroom
    // above the original 0..600 design grid. Combined with the parent
    // `.loader-screen__lottie { overflow: visible }` rule this keeps the
    // peak of the market tent from being clipped on shorter containers
    // (mobile portrait, inline replay button, etc.).
    <svg
      viewBox="0 -80 800 680"
      className="h-full w-full overflow-visible"
      preserveAspectRatio="xMidYMax meet"
      role="img"
      aria-hidden
    >
      <defs>
        {/*
         * Sky gradient now mirrors the public landing hero band so the
         * animation drops in seamlessly behind the marketing copy.
         *   page hero: bg-gradient-to-b from-sage-50 to-cream
         *   sage-50  = #f4f8f4
         *   cream    = #fffdf9
         * Coordinator/wizard surfaces still use this same scene as a
         * loader and read fine because both endpoints are off-white;
         * the sage tint is barely perceptible against pure cream.
         */}
        <linearGradient id="premium-loader-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4f8f4" />
          <stop offset="100%" stopColor="#fffdf9" />
        </linearGradient>
        {/*
         * Ground + sidewalk gradients re-tuned to warm canvas / espresso
         * tones so the inline animation reads as a cohesive linen scene
         * instead of a dark-slate cityscape.
         */}
        <linearGradient id="premium-loader-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#d4cdbf" />
          <stop offset="100%" stopColor="#bfb6a6" />
        </linearGradient>
        <linearGradient id="premium-loader-sidewalk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e6e0d2" />
          <stop offset="100%" stopColor="#cfc7b6" />
        </linearGradient>
        {/* `premium-loader-shadow` (feDropShadow) was removed in the
            flat-aesthetic pass — the storefront no longer references
            it. `premium-loader-phone-glow` is still in use by the
            lead character's phone notification flash and stays. */}
        <filter id="premium-loader-phone-glow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <radialGradient id="premium-loader-pin-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.7" />
          <stop offset="40%" stopColor="#c4892e" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#2d5a27" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="premium-loader-market-warmth" cx="50%" cy="80%" r="55%">
          <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
        </radialGradient>
        <mask id="premium-loader-pin-cutout">
          <rect x="0" y="0" width="800" height="600" fill="white" />
          <g transform={`translate(${pinCenterX}, ${pinCenterY + 42 * pinScale})`}>
            <path
              d={PIN_PATH}
              transform={`translate(0, ${-42 * pinScale}) scale(${pinScale * 1.08})`}
              fill="black"
            />
          </g>
        </mask>
      </defs>

      {/* Sky covers the full extended viewBox (-80..600) so the
          headroom above the wordmark stays consistent with the rest
          of the scene background. */}
      <rect x="0" y="-80" width="800" height="680" fill="url(#premium-loader-sky)" />

      {/*
       * Brand wordmark — pinned to the absolute top of the viewport
       * via `dominantBaseline="hanging"` + `WORDMARK_Y = 12`. The
       * extended viewBox (min-y = -80) keeps a 92-unit cushion of
       * sky above the cap-height, so the typography never collides
       * with the storefront, characters, or sidewalk band below.
       */}
      <text
        x={400}
        y={WORDMARK_Y}
        textAnchor="middle"
        dominantBaseline="hanging"
        fontSize={WORDMARK_FONT_SIZE}
        fontWeight={700}
        fill={WORDMARK_FILL}
        style={{
          letterSpacing: `${WORDMARK_LETTER_SPACING}px`,
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        {WORDMARK_TEXT}
      </text>

      {/* Distant buildings — warm canvas tan to harmonize with the linen sky. */}
      <g opacity="0.28" fill="#a89e8b">
        <rect x="40" y="300" width="70" height="120" />
        <rect x="120" y="278" width="55" height="142" />
        <rect x="190" y="290" width="80" height="130" />
        <rect x="670" y="285" width="90" height="135" />
      </g>

      <rect
        x="30"
        y={sidewalkY - 6}
        width="740"
        height="28"
        rx="4"
        fill="url(#premium-loader-sidewalk)"
        opacity="0.85"
      />
      <ellipse cx="400" cy={sidewalkY + 14} rx="340" ry="16" fill="#3a2f24" opacity="0.18" />

      <path
        d={`M 50 ${sidewalkY + 2} Q 280 ${sidewalkY - 4} ${hubX - 40} ${sidewalkY + 1}`}
        stroke="url(#premium-loader-ground)"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d={`M 70 ${sidewalkY + 2} L ${hubX + 20} ${sidewalkY + 2}`}
        stroke="#64748b"
        strokeWidth="2.5"
        strokeDasharray="8 12"
        opacity="0.5"
      />

      {frame.props.filter(isSceneProp).map((prop, index) => (
        <LoaderPropGraphic key={`scene-${prop.type}-${index}`} prop={prop} />
      ))}

      <g opacity={frame.hubOpacity}>
        <MarketLights hubX={hubX} logoTop={logoTop} logoWidth={logoWidth} glow={frame.marketGlow} />
        <ellipse
          cx={hubX}
          cy={logoTop + logoHeight * 0.28}
          rx={logoWidth * 0.52}
          ry={logoHeight * 0.32}
          fill="url(#premium-loader-market-warmth)"
          opacity={frame.marketGlow * 0.9}
        />
        {/* Storefront group used to be wrapped in
            `<g filter="url(#premium-loader-shadow)">` (a feDropShadow
            blur). The drop-shadow filter has been removed for a clean,
            flat aesthetic — the market tent now reads as a crisp 2D
            silhouette against the linen sky, matching the rest of the
            scene's flat-vector vocabulary. The thin contact ellipse
            below the storefront is a flat fill, not a filter, so it
            stays as a subtle "feet planted" anchor. */}
        <g>
          <ellipse
            cx={hubX}
            cy={logoBottomY + 1}
            rx={logoWidth * 0.42}
            ry={8}
            fill="#000000"
            opacity={0.18}
          />
          {frame.doorOpen > 0.04 ? (
            <rect
              x={pinCenterX - 24}
              y={pinCenterY - 6}
              width={48}
              height={42}
              rx={5}
              fill="#fef9c3"
              opacity={frame.doorOpen * 0.5}
            />
          ) : null}
          <image
            href={LOGO_SRC}
            x={logoLeft}
            y={logoTop}
            width={logoWidth}
            height={logoHeight}
            preserveAspectRatio="xMidYMax meet"
            mask={frame.doorOpen > 0.02 ? 'url(#premium-loader-pin-cutout)' : undefined}
          />
          {frame.doorOpen > 0.02 ? (
            <ellipse
              cx={pinCenterX}
              cy={logoBottomY + 1}
              rx={24}
              ry={5}
              fill="#fbbf24"
              opacity={0.18 + frame.doorOpen * 0.22}
            />
          ) : null}
          {frame.doorOpen > 0.02 ? (
            <g transform={`translate(${pinCenterX}, ${pinCenterY + 42 * pinScale})`}>
              <g transform={`rotate(${pinOpenAngle}) scale(${pinDoorScale})`}>
                <path
                  d={PIN_PATH}
                  transform={`translate(0, ${-42 * pinScale}) scale(${pinScale})`}
                  fill="#2d5a27"
                  stroke="#1e3f20"
                  strokeWidth="2.5"
                  opacity={1 - frame.doorOpen * 0.85}
                />
              </g>
            </g>
          ) : null}
        </g>
      </g>

      <ellipse
        cx={(leadMember?.x ?? frame.groupX) - 28}
        cy={sidewalkY + 2}
        rx={
          frame.isPhoneCheck
            ? 52
            : 58 + Math.abs(Math.sin(frame.walkPhase * Math.PI * 2)) * 6
        }
        ry={6}
        fill="#000000"
        opacity={0.24 * frame.groupOpacity * (depthScale < 1 ? depthScale : 1)}
      />

      {frame.props.filter(isVehicleProp).map((prop, index) => (
        <LoaderPropGraphic key={`vehicle-${prop.type}-${index}`} prop={prop} />
      ))}

      {/*
       * People silhouettes — solid black to match the website theme.
       * The previous near-white (`#f8fafc`) palette was chosen for a dark
       * sky; with the linen background, solid black keeps the figures
       * readable as crisp foreground silhouettes.
       */}
      <g
        opacity={frame.groupOpacity}
        stroke="#000000"
        fill="#000000"
        color="#000000"
        transform={depthTransform}
      >
        {frame.members.map((member) => (
          <StickFigure key={member.id} member={member} frame={frame} />
        ))}
      </g>
    </svg>
  )
}

export function PopupLoaderScene({
  variantId,
  mode,
  onReadyToDismiss,
}: {
  variantId: LoaderVariantId
  mode: LoaderControllerMode
  onReadyToDismiss: () => void
}) {
  const [frame, setFrame] = useState(() => computeVariantFrame(variantId, 0))
  const dismissedRef = useRef(false)

  useEffect(() => {
    dismissedRef.current = false
    const controller = createLoaderController({
      variantId,
      mode,
      onFrame: (nextFrame) => setFrame(frameForMode(nextFrame, mode)),
      onReadyToDismiss: () => {
        if (dismissedRef.current) return
        dismissedRef.current = true
        onReadyToDismiss()
      },
    })
    return () => controller.destroy()
  }, [variantId, mode, onReadyToDismiss])

  return (
    <div className="loader-screen__lottie h-full w-full">
      <LoaderSceneSvg frame={frame} />
    </div>
  )
}
