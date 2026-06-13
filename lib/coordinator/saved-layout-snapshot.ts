import type { BoothCell, LayoutRoom, VenueElement } from '@/types/database'

function trim(value: string): string {
  return value.trim()
}

export function normalizeSavedLayoutVenueKey(locationName: string, address: string): {
  locationName: string
  address: string
} {
  return {
    locationName: trim(locationName),
    address: trim(address),
  }
}

function sanitizeCell(cell: BoothCell): BoothCell {
  return {
    ...cell,
    id: crypto.randomUUID(),
    vendorName: '',
    categoryName: '',
    categoryColor: '',
    boothNumber: 0,
  }
}

function sanitizeVenueElement(element: VenueElement): VenueElement {
  return {
    ...element,
    id: crypto.randomUUID(),
  }
}

/** Strip vendor assignments before persisting a reusable layout template. */
export function sanitizeLayoutRoomsForTemplate(rooms: LayoutRoom[]): LayoutRoom[] {
  return rooms.map((room) => ({
    ...room,
    cells: (room.cells ?? []).map((cell) => ({
      ...cell,
      vendorName: '',
      categoryName: '',
      categoryColor: '',
      boothNumber: 0,
    })),
  }))
}

/** Fresh ids so applying a template never collides with the current event layout. */
export function cloneLayoutRoomsForApply(rooms: LayoutRoom[], activeRoomId: string | null): {
  rooms: LayoutRoom[]
  activeRoomId: string
} {
  const idMap = new Map<string, string>()

  const clonedRooms = rooms.map((room) => {
    const nextId = crypto.randomUUID()
    idMap.set(room.id, nextId)
    return {
      ...room,
      id: nextId,
      cells: (room.cells ?? []).map(sanitizeCell),
      venue_elements: (room.venue_elements ?? []).map(sanitizeVenueElement),
    }
  })

  const resolvedActive =
    (activeRoomId && idMap.get(activeRoomId)) ?? clonedRooms[0]?.id ?? ''

  return { rooms: clonedRooms, activeRoomId: resolvedActive }
}
