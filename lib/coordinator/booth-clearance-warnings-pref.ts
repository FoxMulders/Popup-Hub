export const BOOTH_CLEARANCE_WARNINGS_STORAGE_KEY =
  'popup-hub:floor-plan-v2:clearance-warnings'

/** Default on — coordinators see aisle color bands until they opt out. */
export function readClearanceWarningsEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(BOOTH_CLEARANCE_WARNINGS_STORAGE_KEY)
    if (raw === '0') return false
  } catch {
    // Private mode / quota — fall back to enabled.
  }
  return true
}

export function writeClearanceWarningsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(
      BOOTH_CLEARANCE_WARNINGS_STORAGE_KEY,
      enabled ? '1' : '0'
    )
  } catch {
    // Persistence is best-effort.
  }
}
