import { shouldNotifyBoothAssignment } from '@/lib/applications/notify-vendor-booth-assigned'

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

assert(
  shouldNotifyBoothAssignment(null, 5, true),
  'first booth assignment should notify'
)
assert(
  !shouldNotifyBoothAssignment(5, 5, true),
  'unchanged booth on re-save should not notify'
)
assert(
  shouldNotifyBoothAssignment(4, 5, true),
  'booth reassignment should notify'
)
assert(
  !shouldNotifyBoothAssignment(null, 5, false),
  'failed update must not notify'
)
assert(
  !shouldNotifyBoothAssignment(null, null, true),
  'missing booth number must not notify'
)

console.log('notify-vendor-booth-assigned.test.ts: ok')
