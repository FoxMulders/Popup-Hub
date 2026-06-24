/**
 * Static checks for quarter-auction wallet refund and draw-lock safety.
 *
 * Run: npx tsx scripts/verify-quarter-auction-wallet-safety.ts
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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

const root = join(import.meta.dirname, '..')
const purchasePaddles = readFileSync(
  join(root, 'lib/quarter-auction/purchase-paddles.ts'),
  'utf8'
)
const placeBid = readFileSync(join(root, 'lib/quarter-auction/place-catalog-bid.ts'), 'utf8')
const catalog = readFileSync(join(root, 'lib/quarter-auction/catalog.ts'), 'utf8')

assert(
  !purchasePaddles.includes('update({ balance: wallet.balance })'),
  'paddle purchase does not blind-overwrite wallet balance on refund'
)
assert(
  purchasePaddles.includes('adjustWalletBalance'),
  'paddle purchase uses optimistic refund via adjustWalletBalance'
)
assert(
  placeBid.includes("freshItem?.status !== 'bidding_open'"),
  'bid placement re-checks bidding_open before insert'
)
assert(
  placeBid.includes('refund failed after bid insert error'),
  'bid placement surfaces failed refunds after insert error'
)
assert(
  catalog.includes(".eq('status', 'bidding_closed')") &&
    catalog.includes("status: 'drawing'"),
  'rollDraw atomically locks item from bidding_closed to drawing'
)

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
