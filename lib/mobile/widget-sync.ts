import { isNativeApp } from '@/lib/mobile/native-app'
import { persistWidgetSession, clearWidgetSession } from '@/lib/mobile/widget-bridge'
import type { WidgetSnapshot } from '@/lib/widget/types'

async function mintAndPersistWidgetSession(rotate: boolean): Promise<boolean> {
  const res = await fetch('/api/widget/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rotate, label: 'native-widget' }),
  })
  if (!res.ok) return false

  const data = (await res.json()) as { token?: string; snapshot?: WidgetSnapshot }
  if (!data.token || !data.snapshot) return false

  await persistWidgetSession(data.token, data.snapshot)
  return true
}

/** Mint widget token from API and persist to native shared storage for home-screen widgets. */
export async function syncNativeWidgetSession(): Promise<void> {
  if (!isNativeApp()) return

  try {
    // Avoid rotate on sync — revoking the active token before persist succeeds
    // leaves the widget signed out if native storage write fails.
    if (await mintAndPersistWidgetSession(false)) return

    // Session cookies can lag right after OAuth; retry once before giving up.
    await new Promise((resolve) => setTimeout(resolve, 800))
    await mintAndPersistWidgetSession(false)
  } catch {
    /* non-fatal — widgets show signed-out state */
  }
}

/** Revoke widget tokens and clear native snapshot (call on sign-out). */
export async function revokeNativeWidgetSession(): Promise<void> {
  if (!isNativeApp()) return

  try {
    await fetch('/api/widget/token', { method: 'DELETE' })
  } catch {
    /* ignore */
  }

  await clearWidgetSession()
}
