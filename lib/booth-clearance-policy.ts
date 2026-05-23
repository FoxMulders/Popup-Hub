import type { BoothClearancePolicy } from '@/types/database'

export const CLEARANCE_POLICY_OPTIONS: {
  value: BoothClearancePolicy
  label: string
  shortLabel: string
  description: string
}[] = [
  {
    value: 'not_required',
    label: 'Not required for this event',
    shortLabel: 'Not required',
    description:
      'Skip photo verification. You can still mark booths cleared manually if you want a simple checklist.',
  },
  {
    value: 'leave_furniture',
    label: 'Leave venue tables & chairs',
    shortLabel: 'Leave furniture',
    description:
      'Vendors remove personal banners, stock, and trash. Venue-provided tables and chairs stay in place. Photo proof required.',
  },
  {
    value: 'pack_furniture',
    label: 'Pack away all tables & chairs',
    shortLabel: 'Pack everything',
    description:
      'Vendors must break down and remove all tables, chairs, and personal items before leaving. Photo proof required.',
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
