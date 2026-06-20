import type { BoothMapLabelMode } from '@/lib/coordinator/booth-map-label'
import {
  readClearanceWarningsEnabled,
  writeClearanceWarningsEnabled,
} from '@/lib/coordinator/booth-clearance-warnings-pref'
import {
  isCategorySeparationEnabled,
  setCategorySeparationEnabled,
} from '@/lib/floor-plan/category-separation-prefs'

export type HubGridLayoutMode = 'simple' | 'pro'

const STORAGE_KEY = 'popup-hub:hubgrid-layout-mode'

export function readHubGridLayoutMode(): HubGridLayoutMode {
  if (typeof window === 'undefined') return 'simple'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'pro') return 'pro'
  } catch {
    // ignore
  }
  return 'simple'
}

export function writeHubGridLayoutMode(mode: HubGridLayoutMode): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // ignore
  }
}

export interface HubGridLayoutModeSettings {
  showClearanceWarnings: boolean
  categorySeparationEnabled: boolean
  boothMapLabelMode: BoothMapLabelMode
}

/** Simple = booth numbers, no clearance/category enforcement visuals. Pro = full HubGrid rules. */
export function settingsForHubGridLayoutMode(mode: HubGridLayoutMode): HubGridLayoutModeSettings {
  if (mode === 'pro') {
    return {
      showClearanceWarnings: true,
      categorySeparationEnabled: true,
      boothMapLabelMode: 'vendor',
    }
  }
  return {
    showClearanceWarnings: false,
    categorySeparationEnabled: false,
    boothMapLabelMode: 'boothId',
  }
}

/** Resolve live toolbar state — honors explicit pro/simple choice, falls back to legacy toggles in pro mode. */
export function resolveHubGridLayoutModeSettings(mode: HubGridLayoutMode): HubGridLayoutModeSettings {
  if (mode === 'simple') return settingsForHubGridLayoutMode('simple')
  return {
    showClearanceWarnings: readClearanceWarningsEnabled(),
    categorySeparationEnabled: isCategorySeparationEnabled(),
    boothMapLabelMode: 'vendor',
  }
}

export function applyHubGridLayoutMode(mode: HubGridLayoutMode): HubGridLayoutModeSettings {
  const settings = settingsForHubGridLayoutMode(mode)
  writeHubGridLayoutMode(mode)
  writeClearanceWarningsEnabled(settings.showClearanceWarnings)
  setCategorySeparationEnabled(settings.categorySeparationEnabled)
  return settings
}

export function hubGridLayoutModeLabel(mode: HubGridLayoutMode): string {
  return mode === 'simple' ? 'Simple' : 'Pro'
}
