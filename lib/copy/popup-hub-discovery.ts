/** Patron/vendor discover empty states — clarify Popup Hub vs other local markets. */

export const popupHubDiscoveryPromo =
  'Markets and quarter auctions happen nearby all the time — many are not on Popup Hub yet. Tell organizers and vendors about the platform so the next market shows up here.'

export const popupHubDiscoveryPromoCompact =
  'Pop-ups happen nearby that are not on Popup Hub yet — spread the word to organizers and vendors.'

export const noPopupHubCommunityMarketsHeadline =
  'No Popup Hub community markets match this day and area.'

export const noPopupHubQuarterAuctionsHeadline =
  'No Popup Hub quarter auctions match this day and area.'

export const noPopupHubMarketsNearby = 'No Popup Hub markets nearby'

export const noPopupHubUpcomingInArea =
  'No Popup Hub markets listed here yet — other markets may still be happening nearby.'

export const noPopupHubPublishedInCity =
  'No Popup Hub markets published in this area yet. Browse all of Alberta, check vendor applications, or help spread the word.'

export type PopupHubOpenMarketsEmptyVariant =
  | 'search'
  | 'filters'
  | 'map_search'
  | 'map_radius'

export function noPopupHubOpenMarketsMessage(variant: PopupHubOpenMarketsEmptyVariant): string {
  switch (variant) {
    case 'search':
      return 'No Popup Hub markets match your search.'
    case 'filters':
      return 'No Popup Hub markets match your filters.'
    case 'map_search':
      return 'No Popup Hub markets match your search on the map — try widening the radius or clearing search.'
    case 'map_radius':
      return 'No Popup Hub markets within this distance — pan the map or widen the radius.'
  }
}
