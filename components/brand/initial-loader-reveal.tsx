'use client'

import { useEffect, useRef, useState } from 'react'
import {
  createInitialLoaderController,
  INITIAL_LOADER,
  initialLoaderFrame,
  type InitialLoaderFrame,
} from '@/lib/brand/initial-loader-controller'
import { useBrandLogoSrc } from '@/hooks/use-brand-logo-src'

const LOGO_ASPECT = 1
/** Storefront pin sits ~57% from the top of the square icon. */
const LOGO_ICON_ANCHOR_Y = 0.57
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
  /** Order in the deck deal (0 = first card out). */
  dealOrder: number
  wall?: 'left' | 'right'
}

function easeOutCubic(value: number) {
  return 1 - (1 - value) ** 3
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

type ScatterPose = { x: number; y: number; rot: number }

/** Tight deck pile in the ring center — each card slightly fanned. */
function deckPose(
  booth: BoothRect,
  stackIndex: number,
  deck: { cx: number; cy: number },
): ScatterPose {
  const fan = stackIndex * 1.35
  return {
    x: deck.cx - booth.w / 2 + fan * 0.55,
    y: deck.cy - booth.h / 2 - fan * 0.42,
    rot: stackIndex * 2.4 - 4,
  }
}

/** One card at a time — each finishes before the next leaves the deck. */
function dealCardProgress(t: number, dealOrder: number, total: number): number {
  if (total <= 0) return 1
  const slot = 1 / total
  const overlap = slot * 0.08
  const local = (t - dealOrder * (slot - overlap)) / slot
  return easeOutCubic(clamp01(local))
}

type PerimeterRing = {
  booths: BoothRect[]
  inner: { left: number; right: number; top: number; bottom: number; cx: number; cy: number }
}

/** Place stalls on four sides — 3 per edge, sides paired so L0↔R1 and R0↔L1 share a row. */
function buildPerimeterRing(): PerimeterRing {
  const BOOTH_W = 48
  const BOOTH_H = 36
  const MARGIN = 44
  const GAP = 12
  const RING_BOTTOM = 368
  const SIDE_COUNT = 3

  const leftX = MARGIN
  const rightX = 480 - MARGIN - BOOTH_W
  const topY = MARGIN
  const bottomY = RING_BOTTOM - BOOTH_H

  const innerLeft = leftX + BOOTH_W + GAP
  const innerRight = rightX - GAP
  const rowSpan = SIDE_COUNT * BOOTH_W + (SIDE_COUNT - 1) * GAP
  const topRowX = innerLeft + (innerRight - innerLeft - rowSpan) / 2

  const CELL = BOOTH_H + GAP
  const sideStartY = topY + BOOTH_H + GAP
  const sideEndY = bottomY - GAP - BOOTH_H
  const sideSpan = (SIDE_COUNT - 1) * CELL
  const sideRow0Y = sideStartY + (sideEndY - sideStartY - sideSpan) / 2

  const rowY = [
    sideRow0Y,
    sideRow0Y + CELL,
    sideRow0Y + 2 * CELL,
  ] as const

  const booths: BoothRect[] = []
  let dealOrder = 0

  const push = (booth: Omit<BoothRect, 'dealOrder'>) => {
    booths.push({ ...booth, dealOrder: dealOrder++ })
  }

  for (let i = 0; i < SIDE_COUNT; i++) {
    push({
      x: topRowX + i * (BOOTH_W + GAP),
      y: topY,
      w: BOOTH_W,
      h: BOOTH_H,
    })
  }

  // Row 0: R0 + L1; row 1: L0 + R1; row 2: L2 + R2.
  push({ x: rightX, y: rowY[0], w: BOOTH_W, h: BOOTH_H, wall: 'right' })
  push({ x: leftX, y: rowY[0], w: BOOTH_W, h: BOOTH_H, wall: 'left' })
  push({ x: leftX, y: rowY[1], w: BOOTH_W, h: BOOTH_H, wall: 'left' })
  push({ x: rightX, y: rowY[1], w: BOOTH_W, h: BOOTH_H, wall: 'right' })
  push({ x: leftX, y: rowY[2], w: BOOTH_W, h: BOOTH_H, wall: 'left' })
  push({ x: rightX, y: rowY[2], w: BOOTH_W, h: BOOTH_H, wall: 'right' })

  for (let i = SIDE_COUNT - 1; i >= 0; i--) {
    push({
      x: topRowX + i * (BOOTH_W + GAP),
      y: bottomY,
      w: BOOTH_W,
      h: BOOTH_H,
    })
  }

  const ringInnerLeft = leftX + BOOTH_W
  const ringInnerRight = rightX
  const ringInnerTop = topY + BOOTH_H
  const ringInnerBottom = bottomY

  const inner = {
    left: ringInnerLeft + GAP,
    right: ringInnerRight - GAP,
    top: ringInnerTop,
    bottom: ringInnerBottom,
    cx: (ringInnerLeft + ringInnerRight) / 2,
    cy: (ringInnerTop + ringInnerBottom) / 2,
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

/** Extended below the booth ring so the progress bar is never clipped. */
const SVG_WIDTH = 480
const SVG_HEIGHT = 400
const PROGRESS_Y = 372
const PROGRESS_X = 90
const PROGRESS_W = 300

function drawProgress(value: number, start: number, end: number) {
  if (value <= start) return 0
  if (value >= end) return 1
  return (value - start) / (end - start)
}

/** Disorganized deck → card deal → logo → progress bar. */
const LOADER_PHASE = {
  /** Hold the fanned deck in the center before dealing. */
  chaos: { start: 0.03, end: 0.26 },
  /** Deal one table at a time from the deck to its perimeter slot. */
  deal: { start: 0.26, end: 0.68 },
  logo: { start: 0.68, end: 0.88 },
  bar: { start: 0.85, end: 1 },
} as const

function InitialLoaderSvg({ frame }: { frame: InitialLoaderFrame }) {
  const logoSrc = useBrandLogoSrc()
  const { progress, phase, globalFrame } = frame
  const breathe = 1 + Math.sin(globalFrame * 0.06) * 0.012

  const chaosT = drawProgress(progress, LOADER_PHASE.chaos.start, LOADER_PHASE.chaos.end)
  const dealT = drawProgress(progress, LOADER_PHASE.deal.start, LOADER_PHASE.deal.end)
  /** Logo fades in after the last card is dealt. */
  const logoT = drawProgress(progress, LOADER_PHASE.logo.start, LOADER_PHASE.logo.end)
  const barT = drawProgress(progress, LOADER_PHASE.bar.start, LOADER_PHASE.bar.end)

  const outroFade =
    phase === 'outro' || phase === 'complete'
      ? clamp01(
          (globalFrame - INITIAL_LOADER.holdFrame) / INITIAL_LOADER.outroFrames,
        )
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
          const flyT = dealCardProgress(dealT, booth.dealOrder, booths.length)
          const stackIndex = booths.length - 1 - booth.dealOrder
          const deck = deckPose(booth, stackIndex, inner)
          const pileWobble =
            flyT < 1 && dealT <= 0
              ? Math.sin(globalFrame * 0.09 + booth.dealOrder * 0.4) * 1.8
              : 0

          const x = flyT >= 1 ? booth.x : lerp(deck.x, booth.x, flyT)
          const y =
            flyT >= 1 ? booth.y : lerp(deck.y + pileWobble, booth.y, flyT)
          const rot = flyT >= 1 ? 0 : lerp(deck.rot, 0, flyT)
          const scale = flyT >= 1 ? 1 : lerp(0.88, 1, flyT)
          const settled = flyT >= 1
          const inDeck = dealT <= 0 || flyT <= 0
          const opacity = inDeck
            ? lerp(0.5, 0.72, chaosT)
            : settled
              ? 0.9
              : lerp(0.72, 0.9, flyT)
          const cx = x + booth.w / 2
          const cy = y + booth.h / 2
          return (
            <g
              key={index}
              opacity={opacity}
              transform={`translate(${cx}, ${cy}) rotate(${rot}) scale(${scale}) translate(${-cx}, ${-cy})`}
            >
              <rect
                x={x}
                y={y}
                width={booth.w}
                height={booth.h}
                rx="5"
                fill={BRAND.sageMuted}
                stroke={BRAND.sage}
                strokeWidth="1.5"
                strokeOpacity={settled ? 0.65 : lerp(0.35, 0.65, flyT)}
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
              href={logoSrc}
              x={-logoDims.width / 2}
              y={-logoDims.height / 2}
              width={logoDims.width}
              height={logoDims.height}
              preserveAspectRatio="xMidYMid meet"
            />
          </g>
        </g>

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
