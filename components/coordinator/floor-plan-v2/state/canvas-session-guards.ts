/**
 * Session flags for canvas bootstrap — survives re-renders and reloads within the tab.
 */

let suppressAutoMainHall = false

const STORAGE_PREFIX = 'floorplan:suppress-main-hall:'

function storageKey(eventId: string): string {
  return `${STORAGE_PREFIX}${eventId}`
}

/** After a manual hard reset, skip automatic Main Hall injection. */
export function getSuppressAutoMainHall(eventId?: string): boolean {
  if (suppressAutoMainHall) return true
  if (typeof window === 'undefined' || !eventId) return false
  try {
    return sessionStorage.getItem(storageKey(eventId)) === '1'
  } catch {
    return false
  }
}

export function setSuppressAutoMainHall(value: boolean, eventId?: string): void {
  suppressAutoMainHall = value
  if (typeof window === 'undefined' || !eventId) return
  try {
    if (value) {
      sessionStorage.setItem(storageKey(eventId), '1')
    } else {
      sessionStorage.removeItem(storageKey(eventId))
    }
  } catch {
    /* ignore quota / private mode */
  }
}
