/**
 * Document vs viewport-locked scroll routing smoke test.
 *
 * Run: npx tsx scripts/verify-document-scroll-routes.ts
 */

import { routeUsesViewportFill } from '../components/layout/portal-workspace-layout'

let pass = 0
let fail = 0

function assert(cond: unknown, msg: string): void {
  if (cond) {
    console.log(`PASS - ${msg}`)
    pass++
  } else {
    console.log(`FAIL - ${msg}`)
    fail++
  }
}

const viewportLocked = [
  '/coordinator/dashboard',
  '/coordinator/events/new',
  '/coordinator/events/abc/layout',
  '/coordinator/events/abc/setup',
  '/coordinator/experience-designer',
]

const documentScroll = [
  '/coordinator/payment-methods',
  '/coordinator/events/abc',
  '/coordinator/events/abc/applications',
  '/coordinator/wallet-topup',
  '/vendor/dashboard',
  '/vendor/applications',
  '/vendor/supplies',
  '/vendor/events',
  '/vendor/passport',
  '/profile',
  '/notifications',
  '/wallet',
]

for (const path of viewportLocked) {
  assert(routeUsesViewportFill(path), `viewport locked: ${path}`)
}

for (const path of documentScroll) {
  assert(!routeUsesViewportFill(path), `document scroll: ${path}`)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
