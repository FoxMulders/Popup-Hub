import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
} from '@/hooks/use-floor-plan-viewport-tier'

/** Human-readable minimum screen size for floor-plan / layout tools. */
export function floorPlanRecommendedScreenLabel(): string {
  const widthIn = Math.round(FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX / 96)
  return `${FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX}px wide (${widthIn}"+ display)`
}

export const FLOOR_PLAN_MOBILE_ADVISORY_TITLE =
  'Floor plan layout is not optimized for mobile devices'

export function floorPlanMobileAdvisoryBody(): string {
  return `Use a screen larger than ${floorPlanRecommendedScreenLabel()} to place booths, edit doors, and run traffic tools. Phones and narrow windows cannot host the layout canvas.`
}
