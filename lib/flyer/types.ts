import { z } from 'zod'

export const parsedFlyerSchema = z.object({
  eventName: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  /**
   * Combined "venue name + address" string used by older callers.
   * Newer responses split this into {@link venueName} + {@link address} so
   * the wizard can populate the dedicated fields directly without parsing.
   */
  location: z.string().nullable().optional(),
  /** Venue/host name printed on the flyer (e.g. "Slovenian Hall"). */
  venueName: z.string().nullable().optional(),
  /** Street address printed on the flyer (e.g. "16703 - 66 Street NW"). */
  address: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  ticketPrice: z.string().nullable().optional(),
})

export type ParsedFlyerResponse = z.infer<typeof parsedFlyerSchema>

export type FlyerFieldKey =
  | 'name'
  | 'description'
  | 'startDate'
  | 'endDate'
  | 'startTime'
  | 'endTime'
  | 'locationName'
  | 'address'
  | 'raffleDonationRequirement'

export interface FlyerFormHandlers {
  getName?: () => string
  getDescription?: () => string
  setEventName?: (value: string) => void
  setDescription?: (value: string) => void
  setStartDate?: (value: string) => void
  setEndDate?: (value: string) => void
  setStartTime?: (value: string) => void
  setEndTime?: (value: string) => void
  setLocationName?: (value: string) => void
  setAddress?: (value: string) => void
  setRaffleDonationRequirement?: (value: string) => void
  setListingType?: (value: 'community_market' | 'garage_yard_sale') => void
}
