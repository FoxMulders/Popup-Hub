import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { VendorApplicationSnapshot } from '@/components/coordinator/dashboard/booth-placement-status'
import { seatApplicationsOnOpenBooths } from '@/lib/coordinator/dashboard-vendor-placement'
import { isGuestTableBooth } from '@/lib/booth-planner/table-shape'

export interface PopulateTestSuiteCanvasResult {
  canvasReady: boolean
  roomId: string | null
  roomName: string | null
  vendors: number
  tableSlots: number
  boothsRequested: number
  boothsPlaced: number
  boothsAssigned: number
  error?: string
}

function resolvePopulateRoomId(
  store: FloorPlanDocStore,
  activeRoomId: string
): { roomId: string | null; roomName: string | null } {
  const rooms = store.doc.rooms ?? []
  const roomId =
    activeRoomId && rooms.some((room) => room.id === activeRoomId)
      ? activeRoomId
      : (rooms[0]?.id ?? null)
  if (!roomId) return { roomId: null, roomName: null }
  const frame = rooms.find((room) => room.id === roomId)
  return { roomId, roomName: frame?.name ?? null }
}

function vendorBoothsInRoom(
  store: FloorPlanDocStore,
  roomId: string
): BoothObject[] {
  const doc = store.readDoc()
  const objectRoom = doc.objectRoom ?? {}
  return doc.objects.filter(
    (object): object is BoothObject =>
      object.kind === 'booth' &&
      !isGuestTableBooth(object) &&
      objectRoom[object.id] === roomId
  )
}

/**
 * Assign seeded test-suite vendors onto vendor booths already on the canvas.
 * Does not erase or replace booth footprints — only fills open slots.
 */
export function populateTestSuiteCanvas(input: {
  store: FloorPlanDocStore
  activeRoomId: string
  approved: readonly VendorApplicationSnapshot[]
}): PopulateTestSuiteCanvasResult {
  const { store, approved } = input
  const { roomId, roomName } = resolvePopulateRoomId(store, input.activeRoomId)

  const tableSlots = approved.reduce(
    (sum, application) => sum + Math.max(1, application.tableCount ?? 1),
    0
  )

  if (!roomId) {
    return {
      canvasReady: false,
      roomId: null,
      roomName: null,
      vendors: approved.length,
      tableSlots,
      boothsRequested: 0,
      boothsPlaced: 0,
      boothsAssigned: 0,
      error: 'Add a room to the floor plan before populating the test suite.',
    }
  }

  const vendorBooths = vendorBoothsInRoom(store, roomId)
  const boothsRequested = vendorBooths.length

  if (boothsRequested <= 0) {
    return {
      canvasReady: true,
      roomId,
      roomName,
      vendors: approved.length,
      tableSlots,
      boothsRequested: 0,
      boothsPlaced: 0,
      boothsAssigned: 0,
      error:
        'Place at least one vendor booth on the canvas before running the test suite.',
    }
  }

  if (tableSlots <= 0) {
    return {
      canvasReady: true,
      roomId,
      roomName,
      vendors: approved.length,
      tableSlots,
      boothsRequested,
      boothsPlaced: boothsRequested,
      boothsAssigned: 0,
      error: 'No vendor table slots to assign.',
    }
  }

  for (const booth of vendorBooths) {
    if (!booth.vendorId && !booth.categoryName) continue
    store.updateObject(
      booth.id,
      {
        vendorId: null,
        categoryName: null,
      } as Partial<BoothObject>,
      { pushHistory: true }
    )
  }

  const openBooths = vendorBoothsInRoom(store, roomId)
  const patches = seatApplicationsOnOpenBooths(approved, openBooths)
  for (const patch of patches) {
    store.updateObject(
      patch.boothId,
      {
        vendorId: patch.vendorId,
        label: patch.label,
        categoryName: patch.categoryName,
      } as Partial<BoothObject>,
      { pushHistory: true }
    )
  }

  return {
    canvasReady: true,
    roomId,
    roomName,
    vendors: approved.length,
    tableSlots,
    boothsRequested,
    boothsPlaced: boothsRequested,
    boothsAssigned: patches.length,
  }
}
