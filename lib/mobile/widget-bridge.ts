import { registerPlugin } from '@capacitor/core'
import type { WidgetSnapshot } from '@/lib/widget/types'

export interface WidgetBridgePlugin {
  save(options: { token: string; snapshotJson: string }): Promise<void>
  clear(): Promise<void>
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge', {
  web: () => import('./widget-bridge-web').then((m) => m.default),
})

export async function persistWidgetSession(token: string, snapshot: WidgetSnapshot): Promise<void> {
  await WidgetBridge.save({
    token,
    snapshotJson: JSON.stringify(snapshot),
  })
}

export async function clearWidgetSession(): Promise<void> {
  try {
    await WidgetBridge.clear()
  } catch {
    /* web / plugin unavailable */
  }
}

export { WidgetBridge }
