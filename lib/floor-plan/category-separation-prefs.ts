const STORAGE_KEY = 'popuphub.layout-editor.category-separation'

/** When true, same-category booths must stay ≥4 columns and ≥2 rows apart (manual + auto-arrange). */
export function isCategorySeparationEnabled(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === '0') return false
  } catch {
    // ignore
  }
  return true
}

export function setCategorySeparationEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // ignore
  }
}
