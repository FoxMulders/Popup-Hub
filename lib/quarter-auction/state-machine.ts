import type { AuctionItemStatus } from '@/types/database'

const TRANSITIONS: Record<AuctionItemStatus, AuctionItemStatus[]> = {
  draft: ['queued', 'cancelled'],
  queued: ['active_price_setting', 'cancelled'],
  active_price_setting: ['bidding_open', 'queued', 'cancelled'],
  bidding_open: ['bidding_closed', 'cancelled'],
  bidding_closed: ['drawing', 'bidding_open', 'cancelled'],
  drawing: ['completed'],
  completed: [],
  cancelled: [],
}

export function canTransition(from: AuctionItemStatus, to: AuctionItemStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isLiveStatus(status: AuctionItemStatus): boolean {
  return [
    'active_price_setting',
    'bidding_open',
    'bidding_closed',
    'drawing',
  ].includes(status)
}

export function statusLabel(status: AuctionItemStatus): string {
  const labels: Record<AuctionItemStatus, string> = {
    draft: 'Draft',
    queued: 'Queued',
    active_price_setting: 'Set entry price',
    bidding_open: 'Bidding open',
    bidding_closed: 'Bidding closed',
    drawing: 'Drawing winner',
    completed: 'Completed',
    cancelled: 'Cancelled',
  }
  return labels[status]
}

export function patronScreenForStatus(status: AuctionItemStatus): string {
  switch (status) {
    case 'active_price_setting':
      return 'waiting'
    case 'bidding_open':
      return 'select_paddles'
    case 'bidding_closed':
    case 'drawing':
      return 'hold_up_phone'
    case 'completed':
      return 'result'
    default:
      return 'waiting'
  }
}
