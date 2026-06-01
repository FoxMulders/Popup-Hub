/**
 * Lightweight localStorage backup for the v2 floor plan doc.
 *
 * Why this exists:
 * Server saves only happen when the coordinator clicks the wizard's
 * "Save market" button (or advances steps). If the browser refreshes
 * mid-edit — accidental tab close, mobile back-gesture, deploy hot
 * reload — every object placed since the last server save is lost.
 *
 * This module persists the in-progress doc to `localStorage` on every
 * commit and rehydrates it on mount, scoped per (event id, room id)
 * pair. The Supabase save is still the source of truth; this is a
 * crash-recovery cache that keeps the canvas state alive across
 * reloads until the next successful save clears it.
 *
 * Versioned because the FloorPlanDoc schema is allowed to evolve.
 * On a version mismatch we ignore the stale draft instead of trying
 * to rehydrate it into a newer shape.
 */

import type { FloorPlanDoc } from './types'

/** Bump when draft shape or hydration policy changes — invalidates stale browser caches. */
const STORAGE_VERSION = 2
const KEY_PREFIX = 'floorplan:v2:draft'

interface LocalDraftEnvelope {
  version: number
  /** ms-since-epoch; used by the rehydration tie-breaker. */
  savedAt: number
  /** Backing room id this draft was edited against. */
  roomId: string
  doc: FloorPlanDoc
}

function storageKey(eventId: string, roomId: string): string {
  return `${KEY_PREFIX}:${eventId}:${roomId}`
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** Persist `doc` for `(eventId, roomId)`. Silent on quota / privacy errors. */
export function saveLocalDraft(
  eventId: string,
  roomId: string,
  doc: FloorPlanDoc
): void {
  const ls = safeStorage()
  if (!ls) return
  try {
    const env: LocalDraftEnvelope = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      roomId,
      doc,
    }
    ls.setItem(storageKey(eventId, roomId), JSON.stringify(env))
  } catch {
    // Storage full / private mode — non-fatal; the next save attempt
    // (or a successful server save) will clear the pressure.
  }
}

/**
 * Load a previously-saved draft. Returns `null` when:
 *   - localStorage is unavailable (SSR / private mode),
 *   - no draft exists for this (eventId, roomId),
 *   - the stored envelope's version doesn't match,
 *   - JSON parsing fails for any reason.
 */
export function loadLocalDraft(
  eventId: string,
  roomId: string
): { doc: FloorPlanDoc; savedAt: number } | null {
  const ls = safeStorage()
  if (!ls) return null
  try {
    const raw = ls.getItem(storageKey(eventId, roomId))
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<LocalDraftEnvelope>
    if (!env || env.version !== STORAGE_VERSION || !env.doc) return null
    return { doc: env.doc as FloorPlanDoc, savedAt: env.savedAt ?? 0 }
  } catch {
    return null
  }
}

/** Drop the cached draft — called after a successful server-side save. */
export function clearLocalDraft(eventId: string, roomId: string): void {
  const ls = safeStorage()
  if (!ls) return
  try {
    ls.removeItem(storageKey(eventId, roomId))
  } catch {
    // ignore
  }
}

/* -----------------------------------------------------------------
 * Multi-room (unified) draft variant
 * -----------------------------------------------------------------
 * The v2 wizard step now edits *all* rooms on a single unified
 * canvas, so the per-(event, room) keying above isn't enough — a
 * crash mid-edit could leave one room's objects saved to one key
 * and another room's objects stale in a different key, with no
 * record of where the room frames sit on the unified canvas.
 *
 * The functions below cache the *whole* unified `FloorPlanDoc`
 * keyed on `eventId` only. The per-room API above is kept intact
 * so other surfaces (legacy single-room flows, tests) keep working
 * without changes.
 */

const MULTI_KEY_PREFIX = 'floorplan:v2:multi-draft'

interface MultiDraftEnvelope {
  version: number
  savedAt: number
  doc: FloorPlanDoc
}

function multiStorageKey(eventId: string): string {
  return `${MULTI_KEY_PREFIX}:${eventId}`
}

/** Persist the unified multi-room doc for `eventId`. */
export function saveMultiRoomDraft(eventId: string, doc: FloorPlanDoc): void {
  const ls = safeStorage()
  if (!ls) return
  try {
    const env: MultiDraftEnvelope = {
      version: STORAGE_VERSION,
      savedAt: Date.now(),
      doc,
    }
    ls.setItem(multiStorageKey(eventId), JSON.stringify(env))
  } catch {
    // Storage full / private mode — non-fatal.
  }
}

/** Load a previously cached multi-room draft for `eventId`. */
export function loadMultiRoomDraft(
  eventId: string
): { doc: FloorPlanDoc; savedAt: number } | null {
  const ls = safeStorage()
  if (!ls) return null
  try {
    const raw = ls.getItem(multiStorageKey(eventId))
    if (!raw) return null
    const env = JSON.parse(raw) as Partial<MultiDraftEnvelope>
    if (!env || env.version !== STORAGE_VERSION || !env.doc) return null
    return { doc: env.doc as FloorPlanDoc, savedAt: env.savedAt ?? 0 }
  } catch {
    return null
  }
}

/** Drop the cached multi-room draft after a successful server save. */
export function clearMultiRoomDraft(eventId: string): void {
  const ls = safeStorage()
  if (!ls) return
  try {
    ls.removeItem(multiStorageKey(eventId))
  } catch {
    // ignore
  }
}
