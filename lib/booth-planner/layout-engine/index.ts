export {
  buildUniversalPerimeterWalls,
  buildUniversalPerimeterWallsSkipping,
  buildLockedStructuralElements,
  type DoorOpening,
} from '@/lib/booth-planner/layout-engine/universal-frame'
export {
  collectObstructedCellKeys,
  collectLockedStructuralCellKeys,
  collectPerimeterWallCellKeys,
} from '@/lib/booth-planner/layout-engine/obstructed-cells'
export {
  evaluateCompositePlacement,
  type CompositePreviewInput,
  type CompositePreviewResult,
} from '@/lib/booth-planner/layout-engine/composite-preview'
export {
  BOOTH_EQUIPMENT_DEPTH_FT,
  BOOTH_OPERATIONAL_DEPTH_FT,
  BOOTH_SHOPPER_AISLE_DEPTH_FT,
} from '@/lib/booth-planner/table-space'
