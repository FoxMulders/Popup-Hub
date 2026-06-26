const DB_NAME = 'popup-hub-coordinator-ops'
const DB_VERSION = 1
const SNAPSHOT_STORE = 'snapshots'
const MUTATION_STORE = 'pending-mutations'

export type CoordinatorMutationType =
  | 'check_in'
  | 'payment_status'
  | 'load_in_status'
  | 'raffle_donation'
  | 'early_exit'
  | 'floor_plan_doc_patch'

export interface PendingCoordinatorMutation {
  id: string
  eventId: string
  type: CoordinatorMutationType
  payload: Record<string, unknown>
  clientTimestamp: number
  attempts: number
}

export interface CoordinatorOpsSnapshot {
  eventId: string
  updatedAt: number
  eventName?: string | null
  applications?: unknown[]
  floorPlanDoc?: unknown
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'eventId' })
      }
      if (!db.objectStoreNames.contains(MUTATION_STORE)) {
        const store = db.createObjectStore(MUTATION_STORE, { keyPath: 'id' })
        store.createIndex('eventId', 'eventId', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function saveCoordinatorOpsSnapshot(
  snapshot: CoordinatorOpsSnapshot
): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite')
    tx.objectStore(SNAPSHOT_STORE).put({
      ...snapshot,
      updatedAt: Date.now(),
    })
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
  db.close()
}

export async function getCoordinatorOpsSnapshot(
  eventId: string
): Promise<CoordinatorOpsSnapshot | null> {
  const db = await openDb()
  const row = await new Promise<CoordinatorOpsSnapshot | null>((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readonly')
    const request = tx.objectStore(SNAPSHOT_STORE).get(eventId)
    request.onsuccess = () => resolve((request.result as CoordinatorOpsSnapshot | undefined) ?? null)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
  db.close()
  return row
}

export async function queueCoordinatorMutation(
  eventId: string,
  type: CoordinatorMutationType,
  payload: Record<string, unknown>
): Promise<PendingCoordinatorMutation> {
  const entry: PendingCoordinatorMutation = {
    id: crypto.randomUUID(),
    eventId,
    type,
    payload,
    clientTimestamp: Date.now(),
    attempts: 0,
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MUTATION_STORE, 'readwrite')
    tx.objectStore(MUTATION_STORE).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
  db.close()
  return entry
}

export async function listPendingCoordinatorMutations(
  eventId: string
): Promise<PendingCoordinatorMutation[]> {
  const db = await openDb()
  const rows = await new Promise<PendingCoordinatorMutation[]>((resolve, reject) => {
    const tx = db.transaction(MUTATION_STORE, 'readonly')
    const index = tx.objectStore(MUTATION_STORE).index('eventId')
    const request = index.getAll(eventId)
    request.onsuccess = () =>
      resolve((request.result ?? []) as PendingCoordinatorMutation[])
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
  db.close()
  return rows.sort((a, b) => a.clientTimestamp - b.clientTimestamp)
}

export async function removePendingCoordinatorMutation(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(MUTATION_STORE, 'readwrite')
    tx.objectStore(MUTATION_STORE).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
  })
  db.close()
}

export function resolveCommitSyncStatus(
  mutationId: string,
  appliedIds: string[]
): { queued: boolean; synced: boolean } {
  const synced = appliedIds.includes(mutationId)
  return { synced, queued: !synced }
}

export async function flushCoordinatorOpsQueue(
  eventId: string
): Promise<{ synced: number; failed: number; remaining: number; appliedIds: string[] }> {
  const pending = await listPendingCoordinatorMutations(eventId)
  if (pending.length === 0) {
    return { synced: 0, failed: 0, remaining: 0, appliedIds: [] }
  }

  try {
    const res = await fetch(`/api/coordinator/events/${encodeURIComponent(eventId)}/ops-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations: pending }),
    })
    if (!res.ok) {
      return { synced: 0, failed: pending.length, remaining: pending.length, appliedIds: [] }
    }
    const body = (await res.json()) as { appliedIds?: string[] }
    const appliedIds = body.appliedIds ?? []
    const applied = new Set(appliedIds)
    let synced = 0
    for (const row of pending) {
      if (applied.has(row.id)) {
        await removePendingCoordinatorMutation(row.id)
        synced += 1
      }
    }
    const remaining = pending.length - synced
    return { synced, failed: remaining, remaining, appliedIds }
  } catch {
    return { synced: 0, failed: pending.length, remaining: pending.length, appliedIds: [] }
  }
}

export async function commitCoordinatorMutation(
  eventId: string,
  type: CoordinatorMutationType,
  payload: Record<string, unknown>
): Promise<{ queued: boolean; synced: boolean }> {
  const entry = await queueCoordinatorMutation(eventId, type, payload)
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { queued: true, synced: false }
  }
  const result = await flushCoordinatorOpsQueue(eventId)
  return resolveCommitSyncStatus(entry.id, result.appliedIds)
}
