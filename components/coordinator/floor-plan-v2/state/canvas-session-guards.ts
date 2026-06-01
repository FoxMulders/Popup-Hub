/**
 * Session flags for canvas bootstrap — survives re-renders within the SPA session.
 */

let suppressAutoMainHall = false

/** After a manual hard reset, skip automatic Main Hall injection. */
export function getSuppressAutoMainHall(): boolean {
  return suppressAutoMainHall
}

export function setSuppressAutoMainHall(value: boolean): void {
  suppressAutoMainHall = value
}
