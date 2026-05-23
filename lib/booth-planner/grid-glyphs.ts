import type { VenueElementType } from '@/types/database'
import type { FrontSide } from '@/lib/booth-planner/co-generated-aisles'

export function fixtureGlyph(type: VenueElementType, locked?: boolean): string | null {
  if (locked) return 'L'
  switch (type) {
    case 'aisle':
      return 'A'
    case 'column':
      return 'W'
    case 'entrance':
      return 'E'
    case 'exit':
      return 'X'
    default:
      return null
  }
}

export function formatCellGlyph(letter: string): string {
  return `[${letter}]`
}

export function clientFrontageSide(
  entrance: 'north' | 'south' | 'east' | 'west'
): FrontSide {
  switch (entrance) {
    case 'south':
      return 'bottom'
    case 'north':
      return 'top'
    case 'west':
      return 'left'
    case 'east':
      return 'right'
  }
}

export const FRONTAGE_ARROW_CLASS: Record<FrontSide, string> = {
  top: 'top-0.5 left-1/2 -translate-x-1/2',
  bottom: 'bottom-0.5 left-1/2 -translate-x-1/2',
  left: 'left-0.5 top-1/2 -translate-y-1/2',
  right: 'right-0.5 top-1/2 -translate-y-1/2',
}
