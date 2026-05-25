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

const LOGO_SRC = '/popup-hub-logo.png'

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
        fill="#f8fafc"
        stroke="#cbd5e1"
        strokeWidth={1.5 * member.scale}
      />
      {member.phone ? (
        <g filter="url(#premium-loader-phone-glow)" opacity={frame.phoneGlow}>
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
          {frame.isPhoneCheck ? (
            <rect
              x={member.phone.x + 3 * member.scale}
              y={member.phone.y + 5 * member.scale}
              width={member.phone.w - 6 * member.scale}
              height={member.phone.h - 10 * member.scale}
              rx={member.scale}
              fill="#bae6fd"
              opacity={0.35 + Math.sin(frame.globalFrame * 0.2) * 0.2}
            />
          ) : null}
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
  const pinOpenAngle = frame.doorOpen * -38
  const pinDoorScale = (1 - frame.doorOpen * 0.15) * pinScale

  return (
    <svg viewBox="0 0 800 600" className="h-full w-full" role="img" aria-hidden>
      <defs>
        <linearGradient id="premium-loader-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="premium-loader-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="premium-loader-sidewalk" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <filter id="premium-loader-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#000000" floodOpacity="0.35" />
        </filter>
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
          <stop offset="100%" stopColor="#7b9b52" stopOpacity="0" />
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

      <rect width="800" height="600" fill="url(#premium-loader-sky)" />

      <g opacity="0.3" fill="#1f2937">
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
      <ellipse cx="400" cy={sidewalkY + 14} rx="340" ry="16" fill="#0b1220" opacity="0.45" />

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
        <g filter="url(#premium-loader-shadow)">
          <ellipse
            cx={hubX}
            cy={logoBottomY + 1}
            rx={logoWidth * 0.42}
            ry={8}
            fill="#000000"
            opacity={0.28}
          />
          <image
            href={LOGO_SRC}
            x={logoLeft}
            y={logoTop}
            width={logoWidth}
            height={logoHeight}
            preserveAspectRatio="xMidYMax meet"
            mask={frame.doorOpen > 0.02 ? 'url(#premium-loader-pin-cutout)' : undefined}
          />
          <ellipse
            cx={pinCenterX}
            cy={pinCenterY + 6}
            rx={34 + frame.doorOpen * 28}
            ry={26 + frame.doorOpen * 18}
            fill="url(#premium-loader-pin-glow)"
            opacity={frame.doorOpen * 0.95}
          />
          {frame.doorOpen > 0.02 ? (
            <g transform={`translate(${pinCenterX}, ${pinCenterY + 42 * pinScale})`}>
              <g transform={`rotate(${pinOpenAngle}) scale(${pinDoorScale})`}>
                <path
                  d={PIN_PATH}
                  transform={`translate(0, ${-42 * pinScale}) scale(${pinScale})`}
                  fill="#2d5a27"
                  stroke="#1e3f20"
                  strokeWidth="2.5"
                  opacity={1 - frame.doorOpen * 0.9}
                />
              </g>
            </g>
          ) : null}
        </g>
      </g>

      <ellipse
        cx={frame.groupX - 28}
        cy={sidewalkY + 2}
        rx={
          frame.isPhoneCheck
            ? 52
            : 58 + Math.abs(Math.sin(frame.walkPhase * Math.PI * 2)) * 6
        }
        ry={6}
        fill="#000000"
        opacity={0.24 * frame.groupOpacity}
      />

      {frame.props.filter(isVehicleProp).map((prop, index) => (
        <LoaderPropGraphic key={`vehicle-${prop.type}-${index}`} prop={prop} />
      ))}

      <g
        opacity={frame.groupOpacity}
        stroke="#f8fafc"
        fill="#f8fafc"
        color="#f8fafc"
        transform={`translate(0, ${frame.groupYOffset})`}
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
    <div className="loader-screen__lottie">
      <LoaderSceneSvg frame={frame} />
    </div>
  )
}
