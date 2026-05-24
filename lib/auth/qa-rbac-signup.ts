/**
 * RBAC signup guard smoke tests — run: npm run test:rbac-signup
 */
import { SIGNUP_ROLES } from '@/lib/auth/rbac'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

export function runSignupRbacQa(): void {
  assert(SIGNUP_ROLES.includes('vendor'), 'Vendor self-signup must be available')
  assert(SIGNUP_ROLES.includes('shopper'), 'Patron signup must remain available')
  assert(SIGNUP_ROLES.includes('coordinator'), 'Coordinator signup must remain available')
  console.log('✓ signup RBAC QA passed')
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('qa-rbac-signup')) {
  runSignupRbacQa()
}
