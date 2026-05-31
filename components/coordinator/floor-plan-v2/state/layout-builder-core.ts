/**
 * Layout builder — re-exports from `canvas-engine` (single implementation).
 */

export {
  activeRoomFrames as layoutRooms,
  boundsCentroid as boundsCenter,
  ensureCanvasHasPlaceableRoom as ensureLayoutNotVoid,
  findRoomAtPoint,
  isValidPlacementLocation,
  MAIN_HALL_ROOM_ID as MAIN_HALL_ID,
  DEFAULT_MAIN_HALL_SIZE_FT as DEFAULT_MAIN_HALL_FT,
  makeDefaultMainHallFrame as makeDefaultMainHall,
  pointInPolygon,
  roomGeometricCentroid as roomPerimeterCentroid,
  unionActiveRoomBounds as unionRoomBounds,
  type ViewportMatrix as LayoutViewportMatrix,
} from '../canvas/canvas-engine'
