export type Role = 'shopper' | 'vendor' | 'coordinator'
export type BookingMode = 'instant' | 'juried'
export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'paid' | 'refunded'
export type AuctionStatus = 'upcoming' | 'active' | 'ended' | 'cancelled'
export type TransactionType = 'deposit' | 'withdrawal' | 'quarter_drop' | 'auction_win' | 'refund'
export type NotificationType =
  | 'waitlist_triggered'
  | 'application_approved'
  | 'application_rejected'
  | 'auction_won'
  | 'auction_starting'
  | 'payment_received'

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon_url: string | null
  is_mlm: boolean
}

export interface VendorPassport {
  id: string
  user_id: string
  business_name: string
  primary_category_id: string
  bio: string
  tax_id_encrypted: string | null
  logo_url: string | null
  item_image_urls: string[]
  is_verified: boolean
  created_at: string
  category?: Category
  profile?: Profile
}

export interface Event {
  id: string
  coordinator_id: string
  name: string
  description: string | null
  location_name: string
  address: string
  latitude: number
  longitude: number
  start_at: string
  end_at: string
  booking_mode: BookingMode
  status: EventStatus
  cover_image_url: string | null
  square_merchant_id: string | null
  allow_mlm: boolean
  created_at: string
  coordinator?: Profile
  category_limits?: EventCategoryLimit[]
}

export interface EventCategoryLimit {
  id: string
  event_id: string
  category_id: string
  max_slots: number
  price_per_booth: number
  category?: Category
  approved_count?: number
}

export interface BoothApplication {
  id: string
  event_id: string
  vendor_id: string
  category_id: string
  status: ApplicationStatus
  booth_number: number | null
  square_payment_id: string | null
  payment_status: PaymentStatus
  waitlist_position: number | null
  applied_at: string
  approved_at: string | null
  event?: Event
  vendor?: Profile
  passport?: VendorPassport
  category?: Category
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  paddle_id: string | null
  square_customer_id: string | null
  created_at: string
}

export interface WalletTransaction {
  id: string
  wallet_id: string
  type: TransactionType
  amount: number
  square_payment_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Auction {
  id: string
  event_id: string | null
  coordinator_id: string
  title: string
  item_name: string
  item_image_url: string | null
  status: AuctionStatus
  timer_duration_seconds: number
  timer_ends_at: string | null
  pot_amount: number
  min_drop_amount: number
  max_drop_amount: number
  winning_paddle_id: string | null
  winner_user_id: string | null
  created_at: string
  drops?: AuctionDrop[]
  event?: Event
  coordinator?: Profile
}

export interface AuctionDrop {
  id: string
  auction_id: string
  user_id: string
  paddle_id: string
  amount: number
  dropped_at: string
}

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  message: string
  is_read: boolean
  metadata: Record<string, unknown>
  created_at: string
}

export interface AvailableSlotsResult {
  category_id: string
  max_slots: number
  approved_count: number
  available: number
}
