'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createInitialLoaderController,
  initialLoaderFrame,
  type InitialLoaderFrame,
} from '@/lib/brand/initial-loader-controller'

/** Full lockup (storefront + wordmark) — matches nav/footer brand asset. */
const LOGO_SRC = '/popup-hub-brand.png'
const LOGO_ASPECT = 1024 / 994
const LOGO_DISPLAY_WIDTH = 220
const LOGO_DISPLAY_HEIGHT = LOGO_DISPLAY_WIDTH * LOGO_ASPECT
/** Icon band is ~56% of lockup height from the top (see process-logo.mjs). */
const LOGO_ICON_CENTER_Y = LOGO_DISPLAY_HEIGHT * 0.28

const BRAND = {
  sage: '#2d5a27',
  sageLight: '#4a7a4e',
  sageMuted: '#2d5a2740',
  gold: '#c4892e',
  ink: '#1a1612',
  linen: '#faf8f7',
  cream: '#fffdf9',
} as const

function drawProgress(value: number, start: number, end: number) {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

function strokeReveal(value: number, length: number) {
  const visible = clamp01(value) * length
  return { strokeDasharray: length, strokeDashoffset: length - visible }
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function InitialLoaderSvg({ frame }: { frame: InitialLoaderFrame }) {
  const { progress, phase, globalFrame } = frame
  const breathe = 1 + Math.sin(globalFrame * 0.06) * 0.012

  const gridOpacity = drawProgress(progress, 0, 0.12) * 0.55
  const borderT = drawProgress(progress, 0.08, 0.28)
  const aisleT = drawProgress(progress, 0.22, 0.42)
  const boothT = drawProgress(progress, 0.38, 0.62)
  const logoT = drawProgress(progress, 0.52, 0.82)
  const tagT = drawProgress(progress, 0.72, 0.96)
  const barT = drawProgress(progress, 0.85, 1)

  const outroFade =
    phase === 'outro' || phase === 'complete'
      ? clamp01((globalFrame - 210) / 45)
      : 0
  const masterOpacity = 1 - outroFade * 0.35
  const masterScale = 1 - outroFade * 0.04

  const booths = [
    { x: 56, y: 52, w: 52, h: 38, delay: 0 },
    { x: 136, y: 52, w: 52, h: 38, delay: 0.08 },
    { x: 292, y: 52, w: 52, h: 38, delay: 0.16 },
    { x: 372, y: 52, w: 52, h: 38, delay: 0.24 },
    { x: 56, y: 132, w: 52, h: 38, delay: 0.12 },
    { x: 292, y: 132, w: 132, h: 72, delay: 0.2 },
    { x: 56, y: 248, w: 52, h: 38, delay: 0.28 },
    { x: 136, y: 248, w: 52, h: 38, delay: 0.32 },
    { x: 372, y: 248, w: 52, h: 38, delay: 0.36 },
  ]

  const outerLen = 1480
  const aisleLen = 920
  const outerStroke = strokeReveal(borderT, outerLen)
  const vAisleStroke = strokeReveal(aisleT, 304)
  const hAisleStroke = strokeReveal(aisleT, 416)

  const logoScale = (0.72 + logoT * 0.28) * breathe
  const logoOpacity = logoT
  const ringScale = 0.85 + logoT * 0.35 + Math.sin(globalFrame * 0.08) * 0.02
  const ringOpacity = logoT * 0.45 * (phase === 'hold' ? 1.15 : 1)

  return (
    <div className="initial-loader-reveal" style={{ opacity: masterOpacity }}>
      <div
        className="initial-loader-reveal__glow"
        style={{
          opacity: 0.35 + logoT * 0.45,
          transform: `scale(${1 + logoT * 0.25})`,
        }}
        aria-hidden
      />
      <svg
        viewBox="0 0 480 420"
        className="initial-loader-reveal__svg"
        role="img"
        aria-label="Popup Hub loading"
        preserveAspectRatio="xMidYMid meet"
        style={{ transform: `scale(${masterScale})` }}
      >
        <defs>
          <pattern id="il-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path
              d="M 20 0 L 0 0 0 20"
              fill="none"
              stroke={BRAND.sage}
              strokeOpacity="0.12"
              strokeWidth="0.6"
            />
          </pattern>
          <radialGradient id="il-logo-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={BRAND.sageLight} stopOpacity="0.55" />
            <stop offset="55%" stopColor={BRAND.sage} stopOpacity="0.18" />
            <stop offset="100%" stopColor={BRAND.sage} stopOpacity="0" />
          </radialGradient>
          <linearGradient id="il-bar" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={BRAND.sage} />
            <stop offset="100%" stopColor={BRAND.gold} />
          </linearGradient>
        </defs>

        <rect width="480" height="420" fill="url(#il-grid)" opacity={gridOpacity} />

        <g
          fill="none"
          stroke={BRAND.sage}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.85}
        >
          <rect
            x="40"
            y="36"
            width="400"
            height="280"
            rx="10"
            {...outerStroke}
          />
          <path
            d="M 160 36 L 160 316"
            {...vAisleStroke}
          />
          <path
            d="M 320 36 L 320 316"
            {...vAisleStroke}
          />
          <path
            d="M 40 128 L 440 128"
            {...hAisleStroke}
          />
          <path
            d="M 40 228 L 440 228"
            {...hAisleStroke}
          />
        </g>

        {booths.map((booth, index) => {
          const t = clamp01((boothT - booth.delay) / (1 - booth.delay))
          const scale = 0.88 + t * 0.12
          const cx = booth.x + booth.w / 2
          const cy = booth.y + booth.h / 2
          return (
            <g
              key={index}
              opacity={t * 0.9}
              transform={`translate(${cx}, ${cy}) scale(${scale}) translate(${-cx}, ${-cy})`}
            >
              <rect
                x={booth.x}
                y={booth.y}
                width={booth.w}
                height={booth.h}
                rx="5"
                fill={BRAND.sageMuted}
                stroke={BRAND.sage}
                strokeWidth="1.5"
                strokeOpacity={0.65}
              />
            </g>
          )
        })}

        <g transform="translate(240, 178)">
          <circle
            r={78 * ringScale}
            fill="url(#il-logo-glow)"
            opacity={ringOpacity}
          />
          <circle
            r={62}
            fill="none"
            stroke={BRAND.sageLight}
            strokeWidth="1.5"
            opacity={logoT * 0.35}
            strokeDasharray="4 8"
            transform={`rotate(${globalFrame * 0.4})`}
          />
          <g opacity={logoOpacity} transform={`scale(${logoScale})`}>
            <image
              href={LOGO_SRC}
              x={-LOGO_DISPLAY_WIDTH / 2}
              y={-LOGO_ICON_CENTER_Y}
              width={LOGO_DISPLAY_WIDTH}
              height={LOGO_DISPLAY_HEIGHT}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </g>

        <text
          x="240"
          y="378"
          textAnchor="middle"
          fontSize="13"
          fontWeight="500"
          fill={BRAND.ink}
          opacity={tagT * 0.55}
          style={{
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          Plan · Host · Grow
        </text>

        <rect
          x="140"
          y="396"
          width="200"
          height="3"
          rx="1.5"
          fill={BRAND.sage}
          opacity={0.12}
        />
        <rect
          x="140"
          y="396"
          width={200 * barT}
          height="3"
          rx="1.5"
          fill="url(#il-bar)"
          opacity={0.85}
        />
      </svg>
    </div>
  )
}

export function InitialLoaderReveal({
  onReadyToDismiss,
}: {
  onReadyToDismiss: () => void
}) {
  const [frame, setFrame] = useState(() => initialLoaderFrame(0))
  const dismissedRef = useRef(false)

  useEffect(() => {
    dismissedRef.current = false
    const controller = createInitialLoaderController({
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
    <div className="loader-screen__lottie h-full w-full">
      <InitialLoaderSvg frame={frame} />
    </div>
  )
}
