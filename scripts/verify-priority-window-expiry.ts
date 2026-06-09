import { vendorAccessEqualityUntilFromRelease } from '../lib/engagement/booth-access'

function assert(label: string, condition: boolean) {
  console.log(`${condition ? 'PASS' : 'FAIL'}  ${label}`)
  if (!condition) process.exitCode = 1
}

const release = new Date('2026-01-01T12:00:00.000Z')
const until = vendorAccessEqualityUntilFromRelease(release)
const untilDate = new Date(until)
const diffDays = Math.round((untilDate.getTime() - release.getTime()) / (1000 * 60 * 60 * 24))
assert('equality window is 90 days', diffDays === 90)

console.log('verify-priority-window-expiry done')
