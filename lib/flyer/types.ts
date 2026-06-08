import { z } from 'zod'
import { parsedFlyerListingTypeSchema } from '@/lib/flyer/listing-type'

export { parsedFlyerListingTypeSchema }
export type { ParsedFlyerListingType } from '@/lib/flyer/listing-type'

export const parsedFlyerScheduleTypeSchema = z.enum(['single_day', 'multi_day'])

export const parsedFlyerSchema = z.object({
  eventName: z.string().nullable().optional(),
  /** Legacy single-day date string; prefer startDate/endDate + scheduleType. */
  date: z.string().nullable().optional(),
  listingType: parsedFlyerListingTypeSchema.nullable().optional(),
  scheduleType: parsedFlyerScheduleTypeSchema.nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
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
export type ParsedFlyerScheduleType = z.infer<typeof parsedFlyerScheduleTypeSchema>

export type FlyerFieldKey =
  | 'name'
  | 'description'
  | 'listingType'
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
  setScheduleType?: (value: 'single' | 'multi') => void
  setStartDate?: (value: string) => void
  setEndDate?: (value: string) => void
  setStartTime?: (value: string) => void
  setEndTime?: (value: string) => void
  setDayRows?: (
    rows: Array<{ date: string; start_time: string; end_time: string }>
  ) => void
  setLocationName?: (value: string) => void
  setAddress?: (value: string) => void
  setRaffleDonationRequirement?: (value: string) => void
  setListingType?: (value: 'community_market' | 'garage_yard_sale') => void
}
