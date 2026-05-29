export const VENDOR_DRAG_MIME = 'application/vnd.popuphub.vendor+json'

export type BoothPlacementStatus = 'unassigned' | 'paid' | 'vip_hold' | 'assigned_unpaid'

export const BOOTH_STATUS_THEME: Record<
  BoothPlacementStatus,
  {
    fill: string
    stroke: string
    label: string
    patternId: string
    icon: 'open' | 'paid' | 'vip' | 'assigned'
  }
> = {
  unassigned: {
    fill: '#e7e5e4',
    stroke: '#78716c',
    label: 'Unassigned',
    patternId: 'booth-pattern-unassigned',
    icon: 'open',
  },
  assigned_unpaid: {
    fill: '#d6d3d1',
    stroke: '#57534e',
    label: 'Assigned — unpaid',
    patternId: 'booth-pattern-assigned',
    icon: 'assigned',
  },
  paid: {
    fill: '#bbf7d0',
    stroke: '#15803d',
    label: 'Paid via Square',
    patternId: 'booth-pattern-paid',
    icon: 'paid',
  },
  vip_hold: {
    fill: '#e9d5ff',
    stroke: '#7e22ce',
    label: 'VIP hold',
    patternId: 'booth-pattern-vip',
    icon: 'vip',
  },
}

export function formatCadCurrency(cents: number): string {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(cents / 100)
}
