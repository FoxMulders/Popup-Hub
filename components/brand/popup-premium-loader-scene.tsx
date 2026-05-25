'use client'

import { useEffect, useRef, useState } from 'react'
import {
  computePremiumLoaderFrame,
  createPremiumLoaderController,
  PREMIUM_LOADER,
  type PremiumLoaderFrame,
} from '@/lib/brand/premium-loader-animation'

const LOGO_SRC = '/popup-hub-logo.png'

function Limb({ pose, strokeWidth = 3.5 }: { pose: PremiumLoaderFrame['torso']; strokeWidth?: number }) {
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

function PremiumLoaderSvg({ frame }: { frame: PremiumLoaderFrame }) {
  const { hubX } = PREMIUM_LOADER
  const doorSkew = frame.doorOpen * 4.5
  const doorScale = 1 - frame.doorOpen * 0.58
  const glowOpacity = frame.phoneGlow

  return (
    <svg
      viewBox="0 0 800 600"
      className="h-full w-full"
      role="img"
      aria-hidden
    >
      <defs>
        <linearGradient id="premium-loader-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id="premium-loader-ground" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#334155" />
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
        <radialGradient id="premium-loader-hub-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7b9b52" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#7b9b52" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="800" height="600" fill="url(#premium-loader-sky)" />

      {/* City silhouette */}
      <g opacity="0.35" fill="#1f2937">
        <rect x="40" y="320" width="70" height="120" />
        <rect x="120" y="290" width="55" height="150" />
        <rect x="190" y="305" width="80" height="135" />
        <rect x="290" y="275" width="60" height="165" />
        <rect x="670" y="300" width="90" height="140" />
      </g>

      {/* Ground + path */}
      <ellipse cx="400" cy="430" rx="340" ry="28" fill="#0b1220" opacity="0.55" />
      <path
        d="M 40 410 Q 400 395 760 410"
        stroke="url(#premium-loader-ground)"
        strokeWidth="8"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 80 410 L 720 410"
        stroke="#475569"
        strokeWidth="3"
        strokeDasharray="10 14"
        opacity="0.65"
      />

      {/* Destination hub */}
      <g
        transform={`translate(${hubX - 90}, 250)`}
        opacity={frame.hubOpacity}
        filter="url(#premium-loader-shadow)"
      >
        <ellipse cx="90" cy="168" rx="72" ry="10" fill="#000000" opacity="0.28" />
        <rect x="20" y="70" width="140" height="98" rx="8" fill="#1e293b" stroke="#475569" strokeWidth="2" />
        <rect x="34" y="84" width="112" height="52" rx="6" fill="#243044" stroke="#64748b" strokeWidth="1.5" />

        {/* Logo sign */}
        <rect x="38" y="20" width="104" height="44" rx="6" fill="#faf8f7" stroke="#2d5a27" strokeWidth="2" />
        <image
          href={LOGO_SRC}
          x="44"
          y="26"
          width="92"
          height="32"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Door frame */}
        <rect x="58" y="98" width="64" height="70" rx="4" fill="#0f172a" stroke="#64748b" strokeWidth="2" />

        {/* Door with perspective swing (hinge on left edge) */}
        <g transform="translate(62, 102)">
          <g transform={`scale(${doorScale}, 1) skewY(${-doorSkew})`}>
            <rect x="0" y="0" width="56" height="62" rx="3" fill="#2d5a27" stroke="#7b9b52" strokeWidth="2" />
            <circle cx="48" cy="31" r="3" fill="#c4892e" />
          </g>
        </g>

        {/* Entry glow when door opens */}
        <ellipse
          cx="90"
          cy="128"
          rx={40 + frame.doorOpen * 18}
          ry={24 + frame.doorOpen * 10}
          fill="url(#premium-loader-hub-glow)"
          opacity={frame.doorOpen * 0.9}
        />
      </g>

      {/* Character shadow */}
      <ellipse
        cx={frame.characterX}
        cy={412}
        rx={18 + Math.abs(Math.sin(frame.walkPhase * Math.PI * 2)) * 4}
        ry={5}
        fill="#000000"
        opacity={0.28 * frame.characterOpacity}
      />

      {/* Articulated stick figure */}
      <g opacity={frame.characterOpacity} stroke="#f8fafc" fill="#f8fafc" color="#f8fafc">
        <Limb pose={frame.torso} />
        <Limb pose={frame.leftUpperArm} strokeWidth={3} />
        <Limb pose={frame.leftForearm} strokeWidth={3} />
        <Limb pose={frame.rightUpperArm} strokeWidth={3} />
        <Limb pose={frame.rightForearm} strokeWidth={3} />
        <Limb pose={frame.leftThigh} strokeWidth={3.5} />
        <Limb pose={frame.leftShin} strokeWidth={3.5} />
        <Limb pose={frame.rightThigh} strokeWidth={3.5} />
        <Limb pose={frame.rightShin} strokeWidth={3.5} />

        <circle
          cx={frame.head.cx}
          cy={frame.head.cy}
          r={frame.head.r}
          fill="#f8fafc"
          stroke="#cbd5e1"
          strokeWidth={1.5}
        />

        {/* Phone with glow */}
        <g filter="url(#premium-loader-phone-glow)" opacity={glowOpacity}>
          <rect
            x={frame.phone.x}
            y={frame.phone.y}
            width={frame.phone.w}
            height={frame.phone.h}
            rx={2}
            fill="#38bdf8"
            stroke="#7dd3fc"
            strokeWidth={1}
          />
          <rect
            x={frame.phone.x + 2}
            y={frame.phone.y + 3}
            width={frame.phone.w - 4}
            height={frame.phone.h - 6}
            rx={1}
            fill="#0ea5e9"
            opacity={0.85}
          />
        </g>
      </g>

      {/* Subtle vignette */}
      <rect width="800" height="600" fill="url(#premium-loader-sky)" opacity="0.08" />
    </svg>
  )
}

export function PopupPremiumLoaderScene({
  onReadyToDismiss,
}: {
  onReadyToDismiss: () => void
}) {
  const [frame, setFrame] = useState(() => computePremiumLoaderFrame(0))
  const dismissedRef = useRef(false)

  useEffect(() => {
    const controller = createPremiumLoaderController({
      onFrame: setFrame,
      onReadyToDismiss: () => {
        if (dismissedRef.current) return
        dismissedRef.current = true
        onReadyToDismiss()
      },
    })

    return () => controller.destroy()
  }, [onReadyToDismiss])

  return (
    <div className="loader-screen__lottie">
      <PremiumLoaderSvg frame={frame} />
    </div>
  )
}
