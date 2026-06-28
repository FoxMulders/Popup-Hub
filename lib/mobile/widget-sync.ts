import { isNativeApp } from '@/lib/mobile/native-app'
import { persistWidgetSession, clearWidgetSession } from '@/lib/mobile/widget-bridge'
import type { WidgetSnapshot } from '@/lib/widget/types'

/** Mint widget token from API and persist to native shared storage for home-screen widgets. */
export async function syncNativeWidgetSession(): Promise<void> {
  if (!isNativeApp()) return

  try {
    const res = await fetch('/api/widget/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rotate: true, label: 'native-widget' }),
    })
    if (!res.ok) return

    const data = (await res.json()) as { token?: string; snapshot?: WidgetSnapshot }
    if (!data.token || !data.snapshot) return

    await persistWidgetSession(data.token, data.snapshot)
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
