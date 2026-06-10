/** Minimum clear aisle width for two double-strollers plus buffer (1′ grid cells). */
export const MIN_STROLLER_AISLE_WIDTH_FT = 8

/** Mandatory unobstructed patron walking path width (ft) between booth rows and walls. */
export const PATRON_AISLE_MIN_FT = 6

/** Target edge-to-edge aisle between two vendor booths (ft). */
export const VENDOR_BOOTH_AISLE_FT = 3

/** Uniform safety buffer projected outward from every booth edge (1′ grid cells). */
export const BOOTH_EDGE_CLEARANCE_FT = VENDOR_BOOTH_AISLE_FT
export const BOOTH_EDGE_CLEARANCE_CELLS = BOOTH_EDGE_CLEARANCE_FT

/**
 * Per-booth collision buffer (ft). Two adjacent booths each expand by this
 * amount, so edge-to-edge aisle ≈ {@link VENDOR_BOOTH_AISLE_FT} when probes
 * touch — not 2× the aisle target.
 */
export const BOOTH_SAFETY_BUFFER_FT = VENDOR_BOOTH_AISLE_FT / 2

/** Grid cells (1′ grid) — ceil half-aisle for integer cell rings. */
export const BOOTH_SAFETY_BUFFER_CELLS = Math.ceil(BOOTH_SAFETY_BUFFER_FT)

/** Minimum edge-to-edge aisle on the 1′ grid (cells). */
export const BOOTH_CORE_SEPARATION_CELLS = VENDOR_BOOTH_AISLE_FT
