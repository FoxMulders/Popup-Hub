/** Minimum clear aisle width for two double-strollers plus buffer (1′ grid cells). */
export const MIN_STROLLER_AISLE_WIDTH_FT = 8

/** Mandatory unobstructed patron walking path width (ft) between booth rows and walls. */
export const PATRON_AISLE_MIN_FT = 6

/** Mandatory clearance from outer walls and exit doors during grid auto-arrange (ft). */
export const PERIMETER_WALL_CLEARANCE_FT = 5

/**
 * Global minimum booth-to-booth and booth-to-wall spacing (ft).
 * Expanded footprint collision uses this value on every side of the raw booth rect.
 */
export const MIN_CLEARANCE_FT = 3.0

/** Target edge-to-edge aisle between two vendor booths (ft). */
export const VENDOR_BOOTH_AISLE_FT = MIN_CLEARANCE_FT

/** Uniform safety buffer projected outward from every booth edge (1′ grid cells). */
export const BOOTH_EDGE_CLEARANCE_FT = VENDOR_BOOTH_AISLE_FT
export const BOOTH_EDGE_CLEARANCE_CELLS = BOOTH_EDGE_CLEARANCE_FT

/**
 * Per-booth invisible safety buffer (ft) on every side — collision probes,
 * pathfinding impassable zones, and expanded-footprint placement checks.
 */
export const BOOTH_SAFETY_BUFFER_FT = MIN_CLEARANCE_FT

/** Grid cells (1′ grid) — one cell per foot of safety buffer. */
export const BOOTH_SAFETY_BUFFER_CELLS = Math.ceil(BOOTH_SAFETY_BUFFER_FT)

/**
 * Minimum edge-to-edge gap between two vendor booth physical borders (ft).
 * Each booth contributes {@link BOOTH_SAFETY_BUFFER_FT} on the facing edge.
 */
export const BOOTH_PAIR_MIN_EDGE_GAP_FT = MIN_CLEARANCE_FT * 2

/** Grid pitch between adjacent booth footprints (ft). */
export const BOOTH_CORE_SEPARATION_CELLS = BOOTH_PAIR_MIN_EDGE_GAP_FT
