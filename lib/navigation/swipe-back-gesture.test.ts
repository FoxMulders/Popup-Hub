/**
 * Unit checks for swipe-back gesture — run:
 *   npx tsx lib/navigation/swipe-back-gesture.test.ts
 */
import assert from 'node:assert/strict'
import {
  shouldCancelSwipeBack,
  shouldCompleteSwipeBack,
  shouldCompleteSwipeForward,
  shouldStartSwipeBack,
  shouldStartSwipeForward,
  swipeBackEdgeZonePx,
  swipeForwardEdgeZonePx,
} from './swipe-back-gesture'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

function mockElement(options: {
  closestMatch?: boolean
  touchAction?: string
}): Element {
  const node = {
    closest() {
      return options.closestMatch ? node : null
    },
    parentElement: null as Element | null,
  }
  return node as unknown as Element
}

console.log('swipe-back-gesture')

test('edge zone includes safe area inset', () => {
  assert.equal(swipeBackEdgeZonePx(0), 24)
  assert.equal(swipeBackEdgeZonePx(12), 36)
  assert.equal(swipeForwardEdgeZonePx(0), 24)
  assert.equal(swipeForwardEdgeZonePx(12), 36)
})

test('shouldStartSwipeBack only within edge zone', () => {
  assert.equal(shouldStartSwipeBack({ clientX: 10, clientY: 100 }, 24), true)
  assert.equal(shouldStartSwipeBack({ clientX: 24, clientY: 100 }, 24), true)
  assert.equal(shouldStartSwipeBack({ clientX: 25, clientY: 100 }, 24), false)
})

test('shouldCompleteSwipeBack requires horizontal swipe past threshold', () => {
  assert.equal(shouldCompleteSwipeBack(80, 10), true)
  assert.equal(shouldCompleteSwipeBack(72, 20), true)
  assert.equal(shouldCompleteSwipeBack(71, 10), false)
  assert.equal(shouldCompleteSwipeBack(80, 80), false)
  assert.equal(shouldCompleteSwipeBack(-80, 10), false)
})

test('shouldStartSwipeForward only within right edge zone', () => {
  assert.equal(shouldStartSwipeForward({ clientX: 390, clientY: 100 }, 24, 390), true)
  assert.equal(shouldStartSwipeForward({ clientX: 366, clientY: 100 }, 24, 390), true)
  assert.equal(shouldStartSwipeForward({ clientX: 365, clientY: 100 }, 24, 390), false)
})

test('shouldCompleteSwipeForward requires leftward horizontal swipe', () => {
  assert.equal(shouldCompleteSwipeForward(-80, 10), true)
  assert.equal(shouldCompleteSwipeForward(-72, 20), true)
  assert.equal(shouldCompleteSwipeForward(-71, 10), false)
  assert.equal(shouldCompleteSwipeForward(-80, 80), false)
  assert.equal(shouldCompleteSwipeForward(80, 10), false)
})

test('shouldCancelSwipeBack for opt-out targets', () => {
  const previousDocument = globalThis.document
  const previousGetComputedStyle = globalThis.getComputedStyle

  globalThis.document = {
    querySelector: () => null,
  } as unknown as Document
  globalThis.getComputedStyle = () =>
    ({ touchAction: 'auto' }) as unknown as CSSStyleDeclaration

  try {
    assert.equal(shouldCancelSwipeBack(mockElement({ closestMatch: true })), true)
    assert.equal(shouldCancelSwipeBack(mockElement({ closestMatch: false })), false)
    assert.equal(shouldCancelSwipeBack(null), true)
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousGetComputedStyle
  }
})

test('shouldCancelSwipeBack when sheet overlay is open', () => {
  const previousDocument = globalThis.document
  const previousGetComputedStyle = globalThis.getComputedStyle

  globalThis.document = {
    querySelector: (selector: string) =>
      selector.includes('sheet-overlay') ? ({} as Element) : null,
  } as unknown as Document
  globalThis.getComputedStyle = () =>
    ({ touchAction: 'auto' }) as unknown as CSSStyleDeclaration

  try {
    assert.equal(shouldCancelSwipeBack(mockElement({ closestMatch: false })), true)
  } finally {
    globalThis.document = previousDocument
    globalThis.getComputedStyle = previousGetComputedStyle
  }
})

console.log('All swipe-back-gesture tests passed.')
