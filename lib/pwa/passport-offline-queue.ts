const DB_NAME = 'popup-hub-passport'
const STORE_NAME = 'pending-scans'
const DB_VERSION = 1

export interface PendingPassportScan {
  id: string
  token: string
  createdAt: number
  attempts: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
  })
}

export async function queuePassportScan(token: string): Promise<PendingPassportScan> {
  const entry: PendingPassportScan = {
    id: crypto.randomUUID(),
    token,
    createdAt: Date.now(),
    attempts: 0,
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entry)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'))
  })
  db.close()
  return entry
}

export async function listPendingPassportScans(): Promise<PendingPassportScan[]> {
  const db = await openDb()
  const rows = await new Promise<PendingPassportScan[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).getAll()
    request.onsuccess = () => resolve((request.result ?? []) as PendingPassportScan[])
    request.onerror = () => reject(request.error ?? new Error('IndexedDB read failed'))
  })
  db.close()
  return rows.sort((a, b) => a.createdAt - b.createdAt)
}

export async function removePendingPassportScan(id: string): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'))
  })
  db.close()
}

export async function flushPassportScanQueue(): Promise<{ synced: number; failed: number }> {
  const pending = await listPendingPassportScans()
  let synced = 0
  let failed = 0

  for (const row of pending) {
    try {
      const res = await fetch('/api/passport/scan/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: row.token, queuedAt: row.createdAt }),
      })
      if (res.ok) {
        await removePendingPassportScan(row.id)
        synced += 1
      } else {
        failed += 1
      }
    } catch {
      failed += 1
    }
  }

  return { synced, failed }
}
