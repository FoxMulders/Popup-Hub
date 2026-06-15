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
  /** Left/right perimeter columns — scale-in anchors on the inner edge of each square cell. */
  wall?: 'left' | 'right'
}

/** Angle from room center with 12 o'clock = 0, increasing clockwise (SVG y-down). */
function clockwiseAngleFromTop(cx: number, cy: number, bx: number, by: number): number {
  const angle = Math.atan2(by - cy, bx - cx)
  let ordered = angle + Math.PI / 2
  if (ordered < 0) ordered += 2 * Math.PI
  return ordered
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** One stall per slot — each completes before the next begins. */
function sequentialReveal(t: number, index: number, total: number): number {
  if (total <= 0) return 1
  const slot = 1 / total
  const local = (t - index * slot) / slot
  return easeOutCubic(clamp01(local))
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
  const sideCount = Math.min(
    6,
    Math.max(
      1,
      Math.floor((sideUsable - (CELL - BOOTH_H)) / halfStep) + 1,
    ),
  )
  /** Top row shifts one booth cell right; bottom row mirrors with the same offset left. */
  const topShift = BOOTH_W + GAP

  const booths: BoothRect[] = []

  for (let i = 0; i < topCount; i++) {
    booths.push({
      x: topRowX + topShift + i * (BOOTH_W + GAP),
      y: topY,
      w: BOOTH_W,
      h: BOOTH_H,
    })
  }
  for (let i = 0; i < sideCount; i++) {
    const stagger = i % 2 === 1 ? halfStep : 0
    const y = sideStartY + i * halfStep + (CELL - BOOTH_H)
    // Left column sits on the lower stagger rows (2nd/4th/6th) to mirror the right.
    if (i % 2 === 1) {
      booths.push({
        x: leftX + stagger,
        y,
        w: BOOTH_W,
        h: BOOTH_H,
        wall: 'left',
      })
    }
    // Right column sits on the upper stagger rows (1st/3rd/5th).
    if (i % 2 === 0) {
      booths.push({
        x: rightX - stagger,
        y,
        w: BOOTH_W,
        h: BOOTH_H,
        wall: 'right',
      })
    }
  }
  for (let i = 0; i < topCount; i++) {
    booths.push({
      x: topRowX - topShift + i * (BOOTH_W + GAP),
      y: bottomY,
      w: BOOTH_W,
      h: BOOTH_H,
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

  const sortedBooths = booths
    .map((booth) => {
      const bcx = booth.x + booth.w / 2
      const bcy = booth.y + booth.h / 2
      return {
        booth,
        angle: clockwiseAngleFromTop(inner.cx, inner.cy, bcx, bcy),
      }
    })
    .sort((a, b) => a.angle - b.angle)
    .map(({ booth }) => booth)

  return { booths: sortedBooths, inner }
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
const TAGLINE_WORDS = TAGLINE.split(' ')
const TAGLINE_Y = 392
const PROGRESS_Y = 410
const PROGRESS_X = 90
const PROGRESS_W = 300

function drawProgress(value: number, start: number, end: number) {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

/** Ordered reveal phases — stalls, logo, tagline words, progress bar. */
const LOADER_PHASE = {
  booths: { start: 0.06, end: 0.48 },
  logo: { start: 0.48, end: 0.72 },
  tagline: { start: 0.72, end: 0.92 },
  bar: { start: 0.88, end: 1 },
} as const

function InitialLoaderSvg({ frame }: { frame: InitialLoaderFrame }) {
  const { progress, phase, globalFrame } = frame
  const breathe = 1 + Math.sin(globalFrame * 0.06) * 0.012

  const boothT = drawProgress(progress, LOADER_PHASE.booths.start, LOADER_PHASE.booths.end)
  /** Logo fades in only after the last stall is placed. */
  const logoT = drawProgress(progress, LOADER_PHASE.logo.start, LOADER_PHASE.logo.end)
  /** Tagline words appear one at a time after the logo. */
  const tagT = drawProgress(progress, LOADER_PHASE.tagline.start, LOADER_PHASE.tagline.end)
  const barT = drawProgress(progress, LOADER_PHASE.bar.start, LOADER_PHASE.bar.end)

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
          const t = sequentialReveal(boothT, index, booths.length)
          const scale = 0.88 + t * 0.12
          const anchorX =
            booth.wall === 'left' || booth.wall === 'right'
              ? booth.x + booth.w
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
          style={{
            letterSpacing: '0.14em',
            fontFamily:
              'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          }}
        >
          {TAGLINE_WORDS.map((word, index) => {
            const wordT = sequentialReveal(tagT, index, TAGLINE_WORDS.length)
            return (
              <tspan key={word} opacity={wordT * 0.85}>
                {index > 0 ? '\u00a0' : ''}
                {word}
              </tspan>
            )
          })}
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
