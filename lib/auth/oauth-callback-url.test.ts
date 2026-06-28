import assert from 'node:assert/strict'
import { apiAuthCallbackHref } from '@/lib/auth/oauth-callback-url'

assert.equal(apiAuthCallbackHref(), '/api/auth/callback')
assert.equal(apiAuthCallbackHref('code=abc&next=%2Fdiscover'), '/api/auth/callback?code=abc&next=%2Fdiscover')

console.log('oauth callback url tests passed')
