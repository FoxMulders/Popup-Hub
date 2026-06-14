import type { FloorPlanDocStore } from '@/components/coordinator/floor-plan-v2/state/use-floor-plan-doc'
import type { BoothObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { VendorApplicationSnapshot } from '@/components/coordinator/dashboard/booth-placement-status'
import { seatApplicationsOnOpenBooths } from '@/lib/coordinator/dashboard-vendor-placement'
import { DEFAULT_TABLE_SIZE } from '@/lib/booth-planner/layout-table-size'
import { isGuestTableBooth, vendorTableSpec } from '@/lib/booth-planner/table-shape'
import { fillRoomWithTables } from '@/lib/floor-plan/fill-room-with-tables'

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

/**
 * Fill the active canvas room with vendor booths and assign seeded applications.
 * Uses live room geometry — not category caps or saved layout DB rows.
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

  const tableSpec = vendorTableSpec(DEFAULT_TABLE_SIZE)
  const boothsRequested = tableSlots

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
      error: 'No vendor table slots to place.',
    }
  }

  const fillResult = fillRoomWithTables({
    doc: store.doc,
    roomId,
    count: boothsRequested,
    tableSpec,
    scope: 'vendor',
    packMode: 'dense',
  })

  if (fillResult.placedCount <= 0) {
    return {
      canvasReady: true,
      roomId,
      roomName,
      vendors: approved.length,
      tableSlots,
      boothsRequested,
      boothsPlaced: 0,
      boothsAssigned: 0,
      error: `Could not place vendor booths inside ${roomName ?? 'the room'}.`,
    }
  }

  if (fillResult.arrange?.roomScaledForPatronPath) {
    store.patchDoc(
      {
        rooms: fillResult.doc.rooms,
        canvasWidthFt: fillResult.doc.canvasWidthFt,
        canvasLengthFt: fillResult.doc.canvasLengthFt,
      },
      { pushHistory: true }
    )
  }

  store.patchDoc(
    { objectRoom: fillResult.doc.objectRoom ?? {} },
    { pushHistory: false }
  )
  store.replaceObjects(fillResult.doc.objects, { pushHistory: true })

  const doc = store.readDoc()
  const objectRoom = doc.objectRoom ?? {}
  const vendorBooths = doc.objects.filter(
    (object): object is BoothObject =>
      object.kind === 'booth' &&
      !isGuestTableBooth(object) &&
      objectRoom[object.id] === roomId
  )

  const patches = seatApplicationsOnOpenBooths(approved, vendorBooths)
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
    boothsPlaced: fillResult.placedCount,
    boothsAssigned: patches.length,
  }
}
