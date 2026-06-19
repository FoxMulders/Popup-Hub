import type { BoothObject, PlacedObject } from '@/components/coordinator/floor-plan-v2/state/types'
import type { ParsedLayoutImage } from '@/lib/floor-plan/parse-layout-image-vision'

export interface ImportLayoutFromImageOptions {
  parsed: ParsedLayoutImage
  roomWidthFt: number
  roomLengthFt: number
  defaultTableLengthFt?: number
}

export interface ImportLayoutFromImageResult {
  objects: PlacedObject[]
  roomWidthFt: number
  roomLengthFt: number
  boothCount: number
}

export function importLayoutFromImage(
  options: ImportLayoutFromImageOptions
): ImportLayoutFromImageResult {
  const { parsed } = options
  const roomWidthFt = parsed.roomWidthFt ?? options.roomWidthFt
  const roomLengthFt = parsed.roomLengthFt ?? options.roomLengthFt
  const tableLen = options.defaultTableLengthFt ?? 8
  const objects: PlacedObject[] = []

  for (const fixture of parsed.fixtures) {
    objects.push({
      id: `obj-${crypto.randomUUID()}`,
      kind: fixture.kind === 'label' ? 'label' : fixture.kind,
      x: fixture.x,
      y: fixture.y,
      width: fixture.width,
      height: fixture.height,
      rotation: fixture.rotation ?? 0,
      label: fixture.label ?? undefined,
    } as PlacedObject)
  }

  for (const booth of parsed.booths) {
    const vendorBooth: BoothObject = {
      id: `obj-${crypto.randomUUID()}`,
      kind: 'booth',
      x: booth.x,
      y: booth.y,
      width: booth.width,
      height: booth.height,
      rotation: booth.rotation ?? 0,
      label: booth.label ?? undefined,
      categoryName: null,
      accentColor: null,
      vendorId: null,
      tableLengthFt: tableLen,
      tablePurpose: 'vendor',
      tableShape: 'rectangular',
    }
    objects.push(vendorBooth)
  }

  return {
    objects,
    roomWidthFt,
    roomLengthFt,
    boothCount: parsed.booths.length,
  }
}
