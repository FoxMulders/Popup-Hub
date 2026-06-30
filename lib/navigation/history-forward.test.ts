/**
 * Unit checks for history-forward stack — run:
 *   npx tsx lib/navigation/history-forward.test.ts
 */
import assert from 'node:assert/strict'
import {
  applyPopstatePath,
  canGoBackFromStack,
  canGoForwardFromStack,
  createHistoryStack,
  pushHistoryPath,
} from './history-forward'

function test(name: string, fn: () => void) {
  try {
    fn()
    console.log(`  ✓ ${name}`)
  } catch (e) {
    console.error(`  ✗ ${name}`)
    throw e
  }
}

console.log('history-forward')

test('first screen cannot swipe back or forward', () => {
  const state = createHistoryStack('/discover')
  assert.equal(canGoBackFromStack(state), false)
  assert.equal(canGoForwardFromStack(state), false)
})

test('push enables swipe back on later screens', () => {
  let state = createHistoryStack('/discover')
  state = pushHistoryPath(state, '/events/abc')
  assert.equal(canGoBackFromStack(state), true)
  assert.equal(canGoForwardFromStack(state), false)
})

test('popstate back then forward availability', () => {
  let state = createHistoryStack('/discover')
  state = pushHistoryPath(state, '/events/abc')
  state = applyPopstatePath(state, '/discover')
  assert.equal(canGoBackFromStack(state), false)
  assert.equal(canGoForwardFromStack(state), true)
})

test('popstate forward restores deeper screen', () => {
  let state = createHistoryStack('/discover')
  state = pushHistoryPath(state, '/events/abc')
  state = applyPopstatePath(state, '/discover')
  state = applyPopstatePath(state, '/events/abc')
  assert.equal(canGoBackFromStack(state), true)
  assert.equal(canGoForwardFromStack(state), false)
})

test('push truncates forward branch', () => {
  let state = createHistoryStack('/discover')
  state = pushHistoryPath(state, '/events/a')
  state = applyPopstatePath(state, '/discover')
  state = pushHistoryPath(state, '/events/b')
  assert.equal(state.stack.length, 2)
  assert.equal(canGoForwardFromStack(state), false)
})

console.log('All history-forward tests passed.')
