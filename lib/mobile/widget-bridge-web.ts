import type { WidgetBridgePlugin } from '@/lib/mobile/widget-bridge'

/** Web stub — native widgets only run in Capacitor shell. */
const WidgetBridgeWeb: WidgetBridgePlugin = {
  async save() {
    /* no-op on web */
  },
  async clear() {
    /* no-op on web */
  },
}

export default WidgetBridgeWeb
