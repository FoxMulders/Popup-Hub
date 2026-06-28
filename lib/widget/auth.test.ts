import assert from 'node:assert/strict'
import { resolveWidgetPersonaForAccount } from '@/lib/widget/auth'

assert.equal(resolveWidgetPersonaForAccount('shopper'), 'patron')
assert.equal(resolveWidgetPersonaForAccount('vendor'), 'vendor')
assert.equal(resolveWidgetPersonaForAccount('coordinator'), 'coordinator')
assert.equal(resolveWidgetPersonaForAccount('shopper', true), 'coordinator')
assert.equal(resolveWidgetPersonaForAccount('vendor', true), 'coordinator')

console.log('widget auth tests passed')
