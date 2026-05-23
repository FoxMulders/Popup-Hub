import type { FrontSide } from '@/lib/booth-planner/co-generated-aisles'

/** SVG text group transform — labels read outward toward patrons on the storefront side. */
export interface StorefrontLabelTransform {
  cx: number
  cy: number
  rotate: number
}

const NAME_DY = -6
const UNIT_DY = 6
const BOOTH_DY = 16

export function storefrontLabelTransform(
  side: FrontSide,
  x: number,
  y: number,
  w: number,
  h: number,
  inset = 8
): StorefrontLabelTransform {
  switch (side) {
    case 'bottom':
      return { cx: x + w / 2, cy: y + h - inset, rotate: 0 }
    case 'top':
      return { cx: x + w / 2, cy: y + inset, rotate: 180 }
    case 'left':
      return { cx: x + inset, cy: y + h / 2, rotate: -90 }
    case 'right':
      return { cx: x + w - inset, cy: y + h / 2, rotate: 90 }
  }
}

export function storefrontLabelLineOffsets(): {
  nameDy: number
  unitDy: number
  boothDy: number
} {
  return { nameDy: NAME_DY, unitDy: UNIT_DY, boothDy: BOOTH_DY }
}

/** CSS transform for HTML booth cards (non-SVG fallback). */
export function storefrontLabelCssTransform(side: FrontSide): string {
  switch (side) {
    case 'bottom':
      return 'translate(-50%, -100%) rotate(0deg)'
    case 'top':
      return 'translate(-50%, 0) rotate(180deg)'
    case 'left':
      return 'translate(0, -50%) rotate(-90deg)'
    case 'right':
      return 'translate(-100%, -50%) rotate(90deg)'
  }
}

export function storefrontLabelCssPosition(
  side: FrontSide
): { top?: string; bottom?: string; left?: string; right?: string } {
  const inset = '6px'
  switch (side) {
    case 'bottom':
      return { bottom: inset, left: '50%' }
    case 'top':
      return { top: inset, left: '50%' }
    case 'left':
      return { left: inset, top: '50%' }
    case 'right':
      return { right: inset, top: '50%' }
  }
}
