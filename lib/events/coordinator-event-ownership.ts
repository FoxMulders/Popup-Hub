export const COORDINATOR_EVENT_NOT_OWNER_MESSAGE =
  'This market belongs to another organizer. You can view it but not edit it.'

export function isEventOwner(eventCoordinatorId: string, userId: string): boolean {
  return eventCoordinatorId === userId
}

export function canViewCoordinatorEvent(args: {
  userId: string
  isAdmin: boolean
  eventCoordinatorId: string
}): boolean {
  return args.isAdmin || isEventOwner(args.eventCoordinatorId, args.userId)
}

/** Only the market owner may mutate — platform admins inspect read-only. */
export function canMutateCoordinatorEvent(args: {
  userId: string
  isAdmin: boolean
  eventCoordinatorId: string
}): boolean {
  return isEventOwner(args.eventCoordinatorId, args.userId)
}
