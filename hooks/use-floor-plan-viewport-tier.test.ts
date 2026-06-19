import assert from 'node:assert/strict'
import {
  FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX,
  FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
  FLOOR_PLAN_DESKTOP_REQUIRED_MESSAGE,
  floorPlanViewportTierFromDimensions,
  isPocketSizedViewport,
} from './use-floor-plan-viewport-tier'

assert.equal(
  isPocketSizedViewport(FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX - 1, 800),
  true,
  'width below desktop breaker should require the desktop warning'
)

assert.equal(
  isPocketSizedViewport(1280, FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX - 1),
  true,
  'height below desktop breaker should require the desktop warning'
)

assert.equal(
  floorPlanViewportTierFromDimensions(
    FLOOR_PLAN_DESKTOP_MIN_WIDTH_PX,
    FLOOR_PLAN_DESKTOP_MIN_HEIGHT_PX
  ),
  'desktop',
  'minimum supported dimensions should be treated as desktop'
)

assert.match(
  FLOOR_PLAN_DESKTOP_REQUIRED_MESSAGE,
  /floor plan matrix is not optimized for small screens/i,
  'regression message should warn about small-screen floor plan matrix support'
)

console.log('use-floor-plan-viewport-tier tests passed')
