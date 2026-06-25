import type { BoothCell, LayoutRoom } from '@/types/database'
import type { ShopperRouteMode } from '@/lib/shopper/layout'

export type PublicFloorplanMode = 'patron' | 'vendor-setup'

export function isGuestTableCell(cell: BoothCell): boolean {
  return cell.tablePurpose === 'guest'
}

export function isVendorBoothCell(cell: BoothCell): boolean {
  if (cell.col < 0 || cell.row < 0) return false
  return !isGuestTableCell(cell)
}

export function filterVendorBoothCells(cells: BoothCell[]): BoothCell[] {
  return cells.filter((c) => isVendorBoothCell(c))
}

export function filterGuestTableCells(cells: BoothCell[]): BoothCell[] {
  return cells.filter((c) => c.col >= 0 && c.row >= 0 && isGuestTableCell(c))
}

export function roomHasNamedVendorBooths(room: LayoutRoom): boolean {
  return filterVendorBoothCells(room.cells ?? []).some(
    (c) => (c.vendorName?.trim().length ?? 0) > 0
  )
}

export function defaultRouteModeForRoom(
  room: LayoutRoom | undefined,
  mode: PublicFloorplanMode,
  highlightBoothNumber: number | null | undefined
): ShopperRouteMode {
  if (mode === 'vendor-setup') {
    return highlightBoothNumber != null ? 'vendor' : 'baseline'
  }
  if (!room) return 'baseline'
  return roomHasNamedVendorBooths(room) ? 'exposition' : 'baseline'
}

export function vendorSetupMapUrl(eventId: string): string {
  return `/vendor/events/${eventId}/map`
}

export function patronEventMapUrl(eventId: string, boothNumber?: number | null): string {
  const base = `/events/${eventId}/map`
  if (boothNumber != null && Number.isFinite(boothNumber)) {
    return `${base}?booth=${boothNumber}`
  }
  return base
}
