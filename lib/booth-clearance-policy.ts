import type { BoothClearancePolicy } from '@/types/database'

export const CLEARANCE_POLICY_OPTIONS: {
  value: BoothClearancePolicy
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    value: 'not_required',
    label: 'No checkout photos or teardown required',
    shortLabel: 'Not required',
    description:
      'Vendors can leave without submitting a checkout photo. You can still mark booths cleared manually on market day.',
  },
  {
    value: 'leave_furniture',
    label: 'Vendors clear items; leave venue tables/chairs',
    shortLabel: 'Leave furniture',
    description:
      'Vendors remove banners, stock, and trash, then submit a checkout photo. Host-provided tables and chairs stay in place.',
  },
  {
    value: 'pack_furniture',
    label: 'Vendors clear items and pack tables/chairs',
    shortLabel: 'Pack everything',
    description:
      'Vendors remove all personal items, pack away every table and chair, and submit a checkout photo before leaving.',
  },
]

export function getClearanceInstructions(policy: BoothClearancePolicy): {
  title: string
  body: string
  requiresPhoto: boolean
} {
  switch (policy) {
    case 'not_required':
      return {
        title: 'Clearance not required',
        body: 'This event does not require booth clearance photos. Use manual sign-off if you still want to track departures.',
        requiresPhoto: false,
      }
    case 'pack_furniture':
      return {
        title: 'Pack away all furniture',
        body: 'Vendor must remove all personal banners, stock, trash, and pack away every table and chair before leaving. Take a photo showing the space is completely clear.',
        requiresPhoto: true,
      }
    case 'leave_furniture':
    default:
      return {
        title: 'Leave venue furniture in place',
        body: 'Host-provided venue tables and chairs must be left in place. All personal inventory, displays, and trash must be removed.',
        requiresPhoto: true,
      }
  }
}
