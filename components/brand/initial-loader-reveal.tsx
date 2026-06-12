'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createInitialLoaderController,
  initialLoaderFrame,
  type InitialLoaderFrame,
} from '@/lib/brand/initial-loader-controller'

/** Full lockup (storefront + wordmark) — transparent PNG from process-logo.mjs. */
const LOGO_SRC = '/popup-hub-brand.png'
const LOGO_ASPECT = 994 / 1024
/** Storefront pin sits ~28% from the top of the lockup (see process-logo.mjs). */
const LOGO_ICON_ANCHOR_Y = 0.28
const LOGO_MAX_SCALE = 1.012

function fitLogoInRing(
  inner: PerimeterRing['inner'],
  padding: number,
): { width: number; height: number; anchorY: number } {
  const innerW = inner.right - inner.left - padding * 2
  const maxHeightFromTop =
    (inner.cy - inner.top - padding) / (LOGO_ICON_ANCHOR_Y * LOGO_MAX_SCALE)
  const maxHeightFromBottom =
    (inner.bottom - padding - inner.cy) /
    ((1 - LOGO_ICON_ANCHOR_Y) * LOGO_MAX_SCALE)
  const maxHeight = Math.min(maxHeightFromTop, maxHeightFromBottom) * 0.94
  const maxWidth = (innerW / LOGO_MAX_SCALE) * 0.94

  let height = maxHeight
  let width = height * LOGO_ASPECT
  if (width > maxWidth) {
    width = maxWidth
    height = width / LOGO_ASPECT
  }

  return { width, height, anchorY: height * LOGO_ICON_ANCHOR_Y }
}

type BoothRect = {
  x: number
  y: number
  w: number
  h: number
  delay: number
  /** Left/right perimeter columns — scale-in anchors on the inner edge of each square cell. */
  wall?: 'left' | 'right'
}

type PerimeterRing = {
  booths: BoothRect[]
  inner: { left: number; right: number; top: number; bottom: number; cx: number; cy: number }
}

/** Place stalls on four sides with corner gaps so adjacent sides never overlap. */
function buildPerimeterRing(): PerimeterRing {
  const BOOTH_W = 48
  const BOOTH_H = 36
  const MARGIN = 44
  const GAP = 12
  const RING_BOTTOM = 368

  const leftX = MARGIN
  const rightX = 480 - MARGIN - BOOTH_W
  const topY = MARGIN
  const bottomY = RING_BOTTOM - BOOTH_H

  const topStartX = leftX + BOOTH_W + GAP
  const topMaxX = rightX - GAP - BOOTH_W
  const topUsable = topMaxX - topStartX
  const topCount = Math.max(
    1,
    Math.floor((topUsable + GAP) / (BOOTH_W + GAP)),
  )
  const topSpan = topCount * BOOTH_W + (topCount - 1) * GAP
  const topRowX = topStartX + (topUsable - topSpan) / 2

  const CELL = BOOTH_H + GAP
  const halfStep = CELL / 2

  const sideStartY = topY + BOOTH_H + GAP
  const sideEndY = bottomY - GAP - BOOTH_H
  const sideUsable = sideEndY - sideStartY
  /** One full 48×48 cell per row — half-step spacing stacked booths and read as duplicates. */
  const sideCount = Math.max(1, Math.floor((sideUsable - GAP) / CELL) + 1)

  const booths: BoothRect[] = []
  let delayStep = 0

  for (let i = 0; i < topCount; i++) {
    booths.push({
      x: topRowX + i * (BOOTH_W + GAP),
      y: topY,
      w: BOOTH_W,
      h: BOOTH_H,
      delay: delayStep++ * 0.05,
    })
  }
  for (let i = 0; i < sideCount; i++) {
    const leftStagger = i % 2 === 1 ? halfStep : 0
    const leftY = sideStartY + i * CELL + GAP
    booths.push({
      x: leftX + leftStagger,
      y: leftY,
      w: BOOTH_W,
      h: BOOTH_H,
      delay: delayStep++ * 0.05,
      wall: 'left',
    })
    const rightStagger = i % 2 === 0 ? halfStep : 0
    const rightY = leftY + halfStep
    if (rightY + BOOTH_H <= bottomY) {
      booths.push({
        x: rightX - rightStagger,
        y: rightY,
        w: BOOTH_W,
        h: BOOTH_H,
        delay: delayStep++ * 0.05,
        wall: 'right',
      })
    }
  }
  for (let i = 0; i < topCount; i++) {
    booths.push({
      x: topRowX + i * (BOOTH_W + GAP),
      y: bottomY,
      w: BOOTH_W,
      h: BOOTH_H,
      delay: delayStep++ * 0.05,
    })
  }

  const inner = {
    left: leftX + BOOTH_W + halfStep,
    right: rightX - halfStep,
    top: topY + BOOTH_H,
    bottom: bottomY,
    cx: (leftX + BOOTH_W + halfStep + rightX - halfStep) / 2,
    cy: (topY + BOOTH_H + bottomY) / 2,
  }

  return { booths, inner }
}

const BRAND = {
  sage: '#2d5a27',
  sageLight: '#4a7a4e',
  sageMuted: '#2d5a2740',
  gold: '#c4892e',
  ink: '#1a1612',
  linen: '#faf8f7',
  cream: '#fffdf9',
} as const

/** Extended below the booth ring so the tagline + progress bar are never clipped. */
const SVG_WIDTH = 480
const SVG_HEIGHT = 448
const TAGLINE = 'Markets Made Easy'
const TAGLINE_Y = 392
const PROGRESS_Y = 410
const PROGRESS_X = 90
const PROGRESS_W = 300

function drawProgress(value: number, start: number, end: number) {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function InitialLoaderSvg({ frame }: { frame: InitialLoaderFrame }) {
  const { progress, phase, globalFrame } = frame
  const breathe = 1 + Math.sin(globalFrame * 0.06) * 0.012

  const boothT = drawProgress(progress, 0.1, 0.55)
  /** Logo waits until the perimeter ring has finished appearing. */
  const logoT = drawProgress(progress, 0.58, 0.86)
  const tagT = drawProgress(progress, 0.72, 0.96)
  const barT = drawProgress(progress, 0.85, 1)

  const outroFade =
    phase === 'outro' || phase === 'complete'
      ? clamp01((globalFrame - 210) / 45)
      : 0
  const masterOpacity = 1 - outroFade * 0.35
  const masterScale = 1 - outroFade * 0.04

  const { booths, inner } = buildPerimeterRing()
  const logoPad = 12
  const logoDims = fitLogoInRing(inner, logoPad)
  const innerW = inner.right - inner.left - logoPad * 2
  const innerH = inner.bottom - inner.top - logoPad * 2
  const glowRadius = Math.min(innerW, innerH) * 0.4

  const logoScale = (0.78 + logoT * 0.22) * breathe
  const logoOpacity = logoT
  const ringScale = 0.9 + logoT * 0.1 + Math.sin(globalFrame * 0.08) * 0.015
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
        viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
        className="initial-loader-reveal__svg overflow-visible"
        role="img"
        aria-label="Popup Hub loading"
        preserveAspectRatio="xMidYMid meet"
        overflow="visible"
        style={{ transform: `scale(${masterScale})` }}
      >
        <defs>
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

        <rect width={SVG_WIDTH} height={SVG_HEIGHT} fill={BRAND.cream} />

        {booths.map((booth, index) => {
          const t = clamp01((boothT - booth.delay) / (1 - booth.delay))
          const scale = 0.88 + t * 0.12
          const anchorX =
            booth.wall === 'left'
              ? booth.x + booth.w
              : booth.wall === 'right'
                ? booth.x
                : booth.x + booth.w / 2
          const anchorY = booth.y + booth.h / 2
          return (
            <g
              key={index}
              opacity={t * 0.9}
              transform={`translate(${anchorX}, ${anchorY}) scale(${scale}) translate(${-anchorX}, ${-anchorY})`}
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

        <g transform={`translate(${inner.cx}, ${inner.cy})`}>
          <circle
            r={glowRadius * ringScale}
            fill="url(#il-logo-glow)"
            opacity={ringOpacity}
          />
          <g opacity={logoOpacity} transform={`scale(${logoScale})`}>
            <image
              href={LOGO_SRC}
              x={-logoDims.width / 2}
              y={-logoDims.anchorY}
              width={logoDims.width}
              height={logoDims.height}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </g>

        <text
          x={SVG_WIDTH / 2}
          y={TAGLINE_Y}
          textAnchor="middle"
          fontSize="12"
          fontWeight="500"
          fill={BRAND.ink}
          opacity={tagT * 0.55}
          style={{
            letterSpacing: '0.14em',
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          {TAGLINE}
        </text>

        <rect
          x={PROGRESS_X}
          y={PROGRESS_Y}
          width={PROGRESS_W}
          height="3"
          rx="1.5"
          fill={BRAND.sage}
          opacity={0.12}
        />
        <rect
          x={PROGRESS_X}
          y={PROGRESS_Y}
          width={PROGRESS_W * barT}
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
