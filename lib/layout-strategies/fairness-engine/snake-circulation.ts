import { buildPatronPathway } from '@/components/coordinator/floor-plan-v2/engine/patron-centric-layout'
import {
  DEFAULT_CORRIDOR_WIDTH_FT,
} from '@/lib/vendor-fairness-layout/constants'
import type { Point } from '../types'

/** Serpentine patron circulation centerline (room-local ft). */
export function buildSnakeCirculation(
  roomWidthFt: number,
  roomHeightFt: number,
  entrance: Point,
  exit: Point,
  corridorWidthFt = DEFAULT_CORRIDOR_WIDTH_FT,
  maxBoothDepthFt = 6
): Point[] {
  return buildPatronPathway(
    roomWidthFt,
    roomHeightFt,
    entrance,
    exit,
    corridorWidthFt,
    maxBoothDepthFt
  )
}
