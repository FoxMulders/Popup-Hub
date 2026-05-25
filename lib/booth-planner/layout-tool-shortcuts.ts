import type { VenueElementType } from '@/types/database'

export type LayoutTool = 'vendor' | VenueElementType | 'eraser' | 'lock'

/** Primary palette shortcuts (spec: V W A E X L R). */
export const PRIMARY_LAYOUT_TOOLS: {
  tool: LayoutTool
  label: string
  description: string
  sizeProfile: string
  shortcut: string
}[] = [
  {
    tool: 'vendor',
    label: 'Vendor Booth',
    description: 'Click empty cells to place · click occupied cells to remove',
    sizeProfile: 'Uses active table size (L × 2′ equipment + shared aisle)',
    shortcut: 'V',
  },
  {
    tool: 'column',
    label: 'Wall / Column',
    description: 'Paint structural walls, columns, or obstacles',
    sizeProfile: '1 × 1 cell (1′ × 1′ on high-res grid)',
    shortcut: 'W',
  },
  {
    tool: 'aisle',
    label: 'Aisle',
    description: 'Walkway tile — maintain 8′ clear width for stroller traffic',
    sizeProfile: '1 × 1 cell; paint corridors at least 8 cells wide',
    shortcut: 'A',
  },
  {
    tool: 'entrance',
    label: 'Entrance',
    description: 'Main entrance on the selected outer wall',
    sizeProfile: '1 × 1 door cell on perimeter',
    shortcut: 'E',
  },
  {
    tool: 'exit',
    label: 'Exit',
    description: 'Emergency exit on the wall opposite entrance',
    sizeProfile: '1 × 1 door cell on perimeter',
    shortcut: 'X',
  },
  {
    tool: 'lock',
    label: 'Lock / Select',
    description: 'Select a placed booth for storefront facing, or toggle fixture lock',
    sizeProfile: 'Per-fixture lock icon · booth selection for orientation',
    shortcut: 'L',
  },
  {
    tool: 'eraser',
    label: 'Reset / Erase',
    description: 'Unplace vendors or erase preset aisles and painted fixtures',
    sizeProfile: 'Click target cell',
    shortcut: 'R',
  },
]

export const SHORTCUT_TO_TOOL: Record<string, LayoutTool> = Object.fromEntries(
  PRIMARY_LAYOUT_TOOLS.map((t) => [t.shortcut.toUpperCase(), t.tool])
) as Record<string, LayoutTool>

export function toolShortcutMeta(tool: LayoutTool) {
  return PRIMARY_LAYOUT_TOOLS.find((t) => t.tool === tool)
}

export function toolTooltipLines(tool: LayoutTool): string {
  const meta = toolShortcutMeta(tool)
  if (!meta) return tool
  return `${meta.label} · ${meta.description} · ${meta.sizeProfile} · Shortcut: ${meta.shortcut}`
}

export function gridCellTooltip(input: {
  booth?: { vendorName: string; boothNumber: number; footprint: string; unitLabel?: string }
  fixture?: { label: string; type: string }
  empty?: boolean
  bottleneck?: boolean
}): string {
  if (input.booth) {
    const unit = input.booth.unitLabel ? ` · ${input.booth.unitLabel}` : ''
    return `Booth #${input.booth.boothNumber}: ${input.booth.vendorName} (${input.booth.footprint}${unit})`
  }
  if (input.fixture) {
    return `${input.fixture.label || input.fixture.type} fixture`
  }
  if (input.bottleneck) {
    return 'Aisle bottleneck — walkway under 8′ stroller clearance'
  }
  if (input.empty) {
    return 'Open grid cell (1′ × 1′) — click to paint or place vendor'
  }
  return 'Grid cell'
}
