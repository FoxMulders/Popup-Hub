/** Minimum clear aisle width for two double-strollers plus buffer (1′ grid cells). */
export const MIN_STROLLER_AISLE_WIDTH_FT = 8

/** Uniform safety buffer projected outward from every booth edge (1′ grid cells). */
export const BOOTH_EDGE_CLEARANCE_FT = 2
export const BOOTH_EDGE_CLEARANCE_CELLS = BOOTH_EDGE_CLEARANCE_FT

/** Mandatory safety buffer on each straight booth edge (front, back, left, right). */
export const BOOTH_SAFETY_BUFFER_FT = 2

/** Grid cells (1′ grid) matching {@link BOOTH_SAFETY_BUFFER_FT}. */
export const BOOTH_SAFETY_BUFFER_CELLS = BOOTH_SAFETY_BUFFER_FT

/** Minimum gap between adjacent booth cores (shared buffer: 2′ + 2′). */
export const BOOTH_CORE_SEPARATION_CELLS = BOOTH_SAFETY_BUFFER_CELLS * 2
