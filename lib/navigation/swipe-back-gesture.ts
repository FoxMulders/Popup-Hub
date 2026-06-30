export const SWIPE_BACK_EDGE_PX = 24
export const SWIPE_BACK_MIN_DISTANCE_PX = 72
export const SWIPE_BACK_HORIZONTAL_RATIO = 1.5

export interface TouchPoint {
  clientX: number
  clientY: number
}

export function swipeBackEdgeZonePx(safeAreaInsetLeft = 0): number {
  return SWIPE_BACK_EDGE_PX + Math.max(0, safeAreaInsetLeft)
}

export function shouldStartSwipeBack(
  touch: TouchPoint,
  edgeZonePx = SWIPE_BACK_EDGE_PX
): boolean {
  return touch.clientX <= edgeZonePx
}

export function shouldCompleteSwipeBack(
  deltaX: number,
  deltaY: number,
  minDistance = SWIPE_BACK_MIN_DISTANCE_PX
): boolean {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)
  return deltaX >= minDistance && absX > absY * SWIPE_BACK_HORIZONTAL_RATIO
}

const CANCEL_SELECTORS = [
  '[data-swipe-back="off"]',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[data-slot="sheet-content"]',
  '[data-slot="alert-dialog-content"]',
  '[role="dialog"]',
].join(', ')

function hasTouchActionNone(element: Element): boolean {
  let node: Element | null = element
  while (node) {
    const touchAction = getComputedStyle(node).touchAction
    if (touchAction === 'none') return true
    node = node.parentElement
  }
  return false
}

export function shouldCancelSwipeBack(target: EventTarget | null): boolean {
  if (!target || typeof (target as Element).closest !== 'function') return true

  const element = target as Element

  if (element.closest(CANCEL_SELECTORS)) return true
  if (hasTouchActionNone(element)) return true

  if (
    document.querySelector(
      '[data-slot="sheet-overlay"][data-open], [data-slot="sheet-content"][data-open], [data-slot="alert-dialog-content"][data-open]'
    )
  ) {
    return true
  }

  return false
}

export function readSafeAreaInsetLeft(): number {
  if (typeof document === 'undefined') return 0

  const probe = document.createElement('div')
  probe.style.position = 'fixed'
  probe.style.left = '0'
  probe.style.visibility = 'hidden'
  probe.style.paddingLeft = 'env(safe-area-inset-left)'
  document.documentElement.appendChild(probe)
  const inset = parseFloat(getComputedStyle(probe).paddingLeft) || 0
  probe.remove()
  return inset
}
