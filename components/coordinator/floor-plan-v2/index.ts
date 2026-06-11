export { FloorPlanV2 } from './floor-plan-v2'
export { DebugLogProvider, useDebugLog } from './debug/debug-log-context'
export { DebugLogConsole } from './debug/debug-log-console'
export { DebugLogFooter } from './debug/debug-log-footer'
export { DiagnosticLogger } from './debug/diagnostic-logger'
export { DiagnosticSidebar } from './debug/diagnostic-sidebar'
export type { FloorPlanV2Props } from './floor-plan-v2'
export { useFloorPlanDoc } from './state/use-floor-plan-doc'
export { useCanvasStore } from './state/use-canvas-store'
export type { CanvasStore } from './state/use-canvas-store'
export type {
  FloorPlanDoc,
  PlacedObject,
  ObjectKind,
  BoothObject,
  WallObject,
  OpenWallObject,
  LabelObject,
  DoorObject,
  StageObject,
} from './state/types'
export type { ToolId, DrawShape, ToolState } from './tools/types'
export {
  packBooths,
  packBoothsForRoom,
  packBoothsTrafficAware,
  buildTrafficNoFlyRects,
  AISLE_WIDTH_FT,
  TRAFFIC_PATH_WIDTH_FT,
  BOOTH_CLEARANCE_BUFFER_FT,
} from './engine/AutoArrangeEngine'
export {
  runUnifiedLayoutSolver,
  packBoothsUnifiedForRoom,
  UNIFIED_IDEAL_CLEARANCE_FT,
  minPairwiseClearanceFt,
  countCriticalClearanceViolations,
} from './engine/UnifiedLayoutSolver'
export type {
  UnifiedSolverMeta,
  UnifiedSolverResult,
  ClearanceHeatCell,
} from './engine/UnifiedLayoutSolver'
export type {
  BoothPackInput,
  BoothPlacement,
  PackBoothsResult as TurfPackBoothsResult,
} from './engine/AutoArrangeEngine'
export { CanvasEditor } from './canvas/canvas-editor'
export {
  CalculateOptimalPath,
  buildNavigationGrid,
  astarGrid,
  type PathPoint,
  type OptimalPathResult,
  type NavigationGrid,
} from './engine/PathfindingService'
export { usePathfinding } from './hooks/use-pathfinding'
export {
  activeRoomFrames,
  ensureCanvasHasPlaceableRoom,
  isValidPlacementLocation,
  unionActiveRoomBounds,
} from './canvas/canvas-engine'
