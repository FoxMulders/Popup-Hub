export type Role = 'shopper' | 'vendor' | 'coordinator'
export type EventListingType = 'community_market' | 'garage_yard_sale'
export type BookingMode = 'instant' | 'juried'
export type BoothClearancePolicy = 'not_required' | 'leave_furniture' | 'pack_furniture'
export type BoothContractClauseSource = 'platform' | 'custom'

export interface BoothContractClause {
  id: string
  title: string
  body: string
  source: BoothContractClauseSource
  enabled: boolean
  sort_order: number
}

export type BoothContractSignatureMethod = 'digital' | 'uploaded'

export interface BoothContractSnapshot {
  content_hash: string
  clauses: BoothContractClause[]
  pdf_url: string | null
  acknowledged_at: string
  signature_method?: BoothContractSignatureMethod
  signed_name?: string | null
  signature_image_url?: string | null
  signed_document_url?: string | null
  signed_at?: string
}
export type LayoutSpacingMode = 'standard' | 'table_provided' | 'one_foot'
export type EventStatus = 'draft' | 'published' | 'active' | 'completed' | 'cancelled'
export type ApplicationStatus = 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'cancelled' | 'pending_insurance'
export type PaymentStatus = 'unpaid' | 'pending' | 'payment_required' | 'processing' | 'paid' | 'refunded'
export type PaymentMethod = 'SQUARE' | 'STRIPE' | 'ETRANSFER' | 'CASH'
export type ApplicationPaymentStatus = 'PENDING_REVIEW' | 'COMPLETED' | 'EXPIRED'
export type PayoutOnboardingStatus = 'not_started' | 'pending' | 'complete' | 'restricted'
export type PlatformFeeMode = 'percent' | 'flat' | 'greater_of' | 'percent_plus_flat'
export type PlatformTransactionStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'
export type AuctionStatus = 'upcoming' | 'active' | 'ended' | 'cancelled'
export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'quarter_drop'
  | 'auction_win'
  | 'refund'
  | 'paddle_purchase'
  | 'bid_entry'
export type AuctionItemStatus =
  | 'draft'
  | 'queued'
  | 'active_price_setting'
  | 'bidding_open'
  | 'bidding_closed'
  | 'drawing'
  | 'completed'
  | 'cancelled'
export type NotificationType =
  | 'waitlist_triggered'
  | 'waitlist_promoted'
  | 'application_approved'
  | 'application_rejected'
  | 'auction_won'
  | 'auction_starting'
  | 'payment_received'
  | 'payment_failed'
  | 'coordinator_announcement'
  | 'event_cancelled'
  | 'market_reminder'
  | 'vendor_flash_sale'
  | 'vendor_sold_out'
  | 'vendor_access_approved'
  | 'vendor_access_rejected'
  | 'application_follow_up'
  | 'payment_failed'
  | 'market_feedback'
  | 'feedback_addressed'
  | 'feature_request_submitted'
  | 'priority_booth_invite'
  | 'nearby_market_published'
  | 'coordinator_market_published'

export type VendorAccessRequestStatus = 'pending' | 'approved' | 'rejected'

export type VenueVerificationStatus = 'pending' | 'verified' | 'rejected' | 'manual_override'

export type BoothSlotAccessPhase = 'coordinator_only' | 'priority_exclusive' | 'public_release'

export type PetPolicy = 'pet_friendly' | 'service_animals_only' | 'no_pets'
export type ReminderOffset = 'morning_of' | 'one_day_before' | 'three_days_before' | 'one_week_before'

export type RefundExceptionStatus = 'pending_retry' | 'resolved' | 'abandoned'

export type EventCancellationReason =
  | 'force_majeure'
  | 'low_vendor_turnout'
  | 'logistical_personal'
  | 'other'

export interface RefundException {
  id: string
  event_id: string
  booth_application_id: string
  coordinator_id: string
  vendor_id: string
  square_payment_id: string
  amount_cents: number
  error_message: string
  square_refund_id: string | null
  status: RefundExceptionStatus
  retry_count: number
  last_retry_at: string | null
  resolved_at: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  role: Role
  full_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  is_beta_tester: boolean
  is_admin: boolean
  created_at: string
  reliability_score: number
  total_markets: number
  no_show_count: number
  left_early_count: number
  late_arrival_count?: number
  poor_cleanup_strike_count?: number
  coordinator_cancellation_count?: number
  coordinator_late_cancellation_count?: number
  recent_late_cancellation_at?: string | null
  payout_account_id: string | null
  payout_onboarding_status: PayoutOnboardingStatus
  square_access_token?: string | null
  square_refresh_token?: string | null
  square_token_expires_at?: string | null
  square_location_id?: string | null
  share_contact_with_vendors?: boolean
  etransfer_payment_email?: string | null
  stripe_connected_id?: string | null
  stripe_onboarding_complete?: boolean
  offline_payment_instructions?: string | null
  payment_instructions?: string | null
  platform_wallet_grace_until?: string | null
  platform_wallet_blocked?: boolean
  coordinator_verification_status?: CoordinatorVerificationStatus
  coordinator_organization_name?: string | null
  coordinator_business_number?: string | null
  coordinator_risk_score?: number
  coordinator_account_status?: CoordinatorAccountStatus
  coordinator_is_verified?: boolean
  coordinator_successful_events_count?: number
  updated_at: string
}

export interface Category {
  id: string
  name: string
  icon_url: string | null
  is_mlm: boolean
  requires_documentation?: boolean
  /**
   * Curated "broad" buckets vendors must pick as their passport primary
   * (e.g. Artisan Crafts, Food & Beverage, Home Decor). Niche tags
   * (Macrame & Weaving, Honey & Preserves, etc.) have is_broad=false and
   * may only be used as secondaries / discovery filters / advanced caps.
   */
  is_broad?: boolean
}

export type VendorVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'

export type VendorAccountStatus = 'active' | 'suspended' | 'banned'

export type CoordinatorVerificationStatus =
  | 'unverified'
  | 'pending'
  | 'verified'
  | 'rejected'

export type CoordinatorAccountStatus = 'active' | 'suspended' | 'banned'

export interface VendorPassport {
  id: string
  user_id: string
  business_name: string
  primary_category_id: string
  category_ids: string[]
  bio: string
  tax_id_encrypted: string | null
  logo_url: string | null
  item_image_urls: string[]
  is_verified: boolean
  verification_status?: VendorVerificationStatus
  business_number?: string | null
  social_handle?: string | null
  risk_score?: number
  account_status?: VendorAccountStatus
  website_url: string | null
  shop_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  requires_electricity: boolean
  created_at: string
  category?: Category
  profile?: Profile
}

export type PassportStoryKind = 'behind_the_brand' | 'market_promo' | 'story'
export type PassportStoryMediaType = 'video' | 'image'

export interface PassportStory {
  id: string
  owner_id: string
  media_url: string
  media_type: PassportStoryMediaType
  duration_seconds: number | null
  story_kind: PassportStoryKind
  caption: string | null
  sort_order: number
  created_by: string
  created_at: string
}

export interface EventDay {
  id: string
  event_id: string
  date: string
  start_time: string
  end_time: string
  sort_order: number
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
  listing_type: EventListingType
  status: EventStatus
  cover_image_url: string | null
  square_merchant_id: string | null
  accepts_square?: boolean
  accepts_stripe?: boolean
  accepts_offline_etransfer?: boolean
  accepts_offline_cash?: boolean
  accepts_credit_card?: boolean
  accepts_etransfer?: boolean
  accepts_cash?: boolean
  allow_mlm: boolean
  max_mlm_slots: number | null
  is_multi_day?: boolean
  require_full_attendance: boolean
  market_insurance_required?: boolean
  skip_venue_layout?: boolean
  market_city?: string
  booth_clearance_policy: BoothClearancePolicy
  platform_fee_mode: PlatformFeeMode
  platform_fee_flat_cents: number
  platform_fee_bps: number
  updated_at: string
  created_at: string
  cancellation_reason: EventCancellationReason | null
  cancellation_reason_notes: string | null
  cancelled_at: string | null
  cancellation_notice_days: number | null
  cancellation_penalty_applied: number
  raffle_donation_requirement: string | null
  booth_price_cents: number
  multi_table_discount_percent: number
  community_league_discount_enabled?: boolean
  community_league_discount_percent?: number
  passport_vendors_required: number | null
  parking_notes: string | null
  wheelchair_access_notes: string | null
  pet_policy?: PetPolicy
  venue_verified?: boolean
  venue_verification_status?: VenueVerificationStatus
  venue_verification_reason?: string | null
  venue_verified_at?: string | null
  venue_place_types?: string[]
  vendor_access_equality_until?: string | null
  pass_fees_to_vendor?: boolean
  booth_contract_enabled?: boolean
  booth_contract_clauses?: BoothContractClause[]
  booth_contract_pdf_url?: string | null
  booth_contract_updated_at?: string | null
  coordinator?: Profile
  category_limits?: EventCategoryLimit[]
  event_days?: EventDay[]
}

export interface EventBoothSlot {
  id: string
  event_id: string
  layout_object_id: string
  category_id: string
  access_phase: BoothSlotAccessPhase
  priority_invite_batch_id: string | null
  priority_window_ends_at: string | null
  public_released_at: string | null
  claimed_by_application_id: string | null
  created_at: string
  updated_at: string
}

export interface VendorPriorityInvite {
  id: string
  event_id: string
  vendor_id: string
  booth_slot_id: string
  batch_id: string
  sent_at: string
  expires_at: string
  claimed_at: string | null
}

export interface EventCategoryLimit {
  id: string
  event_id: string
  category_id: string
  max_slots: number
  price_per_booth: number
  booth_type: 'inside' | 'wall' | 'power'
  table_length_ft: number | null
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
  stripe_payment_id: string | null
  payment_status: PaymentStatus
  payment_processing_at: string | null
  payment_method: PaymentMethod | null
  application_payment_status: ApplicationPaymentStatus | null
  etransfer_reference_code: string | null
  etransfer_expires_at: string | null
  waitlist_position: number | null
  has_category_overflow: boolean
  overflow_category_names: string[]
  attending_event_day_ids: string[]
  attending_dates: string[]
  attendance_terms_acknowledged_at: string | null
  booth_contract_acknowledged_at: string | null
  booth_contract_snapshot: BoothContractSnapshot | null
  booth_contract_signed_at: string | null
  booth_contract_signature_method: BoothContractSignatureMethod | null
  applied_at: string
  approved_at: string | null
  checked_in: boolean
  neighbor_preference: string | null
  load_in_window: string | null
  load_in_status: 'on_time' | 'late' | 'missed' | null
  arrived_at: string | null
  left_early: boolean
  early_departure_notes: string | null
  raffle_donation_received: boolean
  booth_cleared: boolean
  booth_cleared_photo_url: string | null
  booth_cleared_at: string | null
  requested_booth_type: 'inside' | 'wall' | 'power' | 'any' | null
  platform_transaction_id: string | null
  table_length_ft: number | null
  table_count: number
  updated_at: string
  event_cancellation_reason: EventCancellationReason | null
  event_cancellation_reason_label: string | null
  applicable_documentation_url: string | null
  market_insurance_url: string | null
  coordinator_review_notes?: string | null
  coordinator_decline_message?: string | null
  community_league_member_claim?: boolean
  event?: Event
  vendor?: Profile
  passport?: VendorPassport
  category?: Category
}

export type SecurityAuditActionType =
  | 'MANUAL_PAYMENT_CLEARANCE'
  | 'STATE_OVERRIDE_APPROVAL'
  | 'APPLICATION_STATUS_CHANGE'
  | 'VENDOR_DISPUTE_SUSPENSION'
  | 'VENDOR_BOOTH_EVICTION'
  | 'PASSPORT_QR_BLOCKED'
  | 'COORDINATOR_COMMUNITY_VERIFIED'
  | 'COORDINATOR_ESCROW_RELEASE'
  | 'COORDINATOR_VENDOR_VOUCH'

export interface AuditSecurityLog {
  id: string
  created_at: string
  actor_id: string
  target_vendor_id: string | null
  application_id: string | null
  action_type: SecurityAuditActionType
  previous_state: Record<string, unknown>
  new_state: Record<string, unknown>
  ip_address: string | null
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  escrow_balance: number
  paddle_id: string | null
  square_customer_id: string | null
  created_at: string
}

export interface CoordinatorVouch {
  id: string
  coordinator_id: string
  vendor_id: string
  created_at: string
}

export type CoordinatorEscrowSettlementMode = 'wallet' | 'external_processor'
export type CoordinatorEscrowHoldStatus = 'held' | 'released' | 'blocked'

export interface CoordinatorEscrowHold {
  id: string
  platform_transaction_id: string
  coordinator_id: string
  event_id: string
  organizer_payout_cents: number
  immediate_release_cents: number
  held_cents: number
  settlement_mode: CoordinatorEscrowSettlementMode
  status: CoordinatorEscrowHoldStatus
  eligible_release_at: string
  released_at: string | null
  processor_transfer_id?: string | null
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

export type WalletDepositMethod = 'etransfer' | 'cash_at_door'
export type WalletDepositStatus = 'pending' | 'completed' | 'cancelled' | 'expired'

export interface WalletDepositRequest {
  id: string
  user_id: string
  amount_cents: number
  method: WalletDepositMethod
  status: WalletDepositStatus
  reference_code: string | null
  event_id: string | null
  confirmed_by: string | null
  wallet_transaction_id: string | null
  expires_at: string | null
  completed_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type WalletWithdrawalMethod = 'cash_at_door' | 'etransfer' | 'card_refund'
export type WalletWithdrawalStatus = 'pending' | 'completed' | 'cancelled' | 'expired'

export interface WalletWithdrawalRequest {
  id: string
  user_id: string
  amount_cents: number
  method: WalletWithdrawalMethod
  status: WalletWithdrawalStatus
  payout_email: string | null
  reference_code: string | null
  event_id: string | null
  confirmed_by: string | null
  wallet_transaction_id: string | null
  square_refund_id: string | null
  expires_at: string | null
  completed_at: string | null
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
  scheduled_start_at: string | null
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

export interface QuarterAuctionSettings {
  event_id: string
  enabled: boolean
  paddle_purchase_credits: number
  default_entry_credits: number
  paddle_pool_size: number
  scheduled_start_at: string | null
  charity_milestones?: { amount_cents: number; label: string }[] | null
  created_at: string
  updated_at: string
}

export interface AuctionCatalogItem {
  id: string
  event_id: string
  vendor_id: string
  title: string
  description: string | null
  image_url: string | null
  retail_value_cents: number | null
  queue_position: number
  status: AuctionItemStatus
  entry_cost_credits: number | null
  pool_credits: number
  winning_paddle_number: string | null
  winner_user_id: string | null
  approved_at: string | null
  bidding_opened_at: string | null
  bidding_closed_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
  vendor?: Profile
  entries?: AuctionItemEntry[]
}

export interface EventPaddle {
  id: string
  event_id: string
  user_id: string
  paddle_number: string
  purchase_credits: number
  purchased_at: string
}

export interface EventAuctionParticipant {
  event_id: string
  user_id: string
  participated_at: string
  check_in_lat: number
  check_in_lng: number
  distance_meters: number | null
}

export interface MarketPatronCheckIn {
  id: string
  event_id: string
  user_id: string
  paddle_number: number
  checked_in_at: string
  check_in_lat: number | null
  check_in_lng: number | null
  distance_meters: number | null
}

export interface PassportScan {
  id: string
  event_id: string
  user_id: string
  vendor_id: string
  scanned_at: string
}

export interface AuctionItemEntry {
  id: string
  catalog_item_id: string
  paddle_id: string
  user_id: string
  paddle_number: string
  credits_spent: number
  entered_at: string
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

/** Audit log for booth payment fee splits (Square charge = Stripe charge equivalent). */
export interface PlatformTransaction {
  id: string
  booth_application_id: string | null
  event_id: string
  vendor_id: string
  coordinator_id: string
  category_id: string | null
  total_amount_charged: number
  organizer_payout_amount: number
  platform_fee_retained: number
  fee_mode_used: PlatformFeeMode
  processor_charge_id: string | null
  processor_transfer_id: string | null
  status: PlatformTransactionStatus
  currency: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface BoothCell {
  id: string
  col: number
  row: number
  colSpan: number
  rowSpan: number
  vendorName: string
  categoryName: string
  categoryColor: string
  boothNumber: number
  boothType?: 'inside' | 'wall' | 'power'
  /** Table (default) or outdoor-only tent footprint. */
  vendorUnitType?: 'table' | 'tent'
  tableLengthFt?: number | null
  /** Vendor booth unit vs guest seating table. */
  tablePurpose?: 'vendor' | 'guest' | null
  /** Folding table (default) vs round banquet table footprint. */
  tableShape?: 'rectangular' | 'round' | null
  /** Manual table length axis; when unset, perimeter placement may auto-rotate. */
  tableOrientation?: 'horizontal' | 'vertical' | null
  /** Manual storefront direction toward wall or corner quadrant. */
  facingTarget?:
    | 'north'
    | 'south'
    | 'east'
    | 'west'
    | 'nw'
    | 'ne'
    | 'sw'
    | 'se'
    | null
}

export type VenueElementType =
  | 'entrance'
  | 'door'
  | 'exit'
  | 'aisle'
  | 'restroom'
  | 'food_court'
  | 'seating'
  | 'stage'
  | 'loading_dock'
  | 'storage'
  | 'info_desk'
  | 'welcome_booth'
  | 'column'
  | 'custom_label'

export interface VenueElement {
  id: string
  type: VenueElementType
  row: number
  col: number
  colSpan?: number
  rowSpan?: number
  label?: string
  /** When true, fixture cannot be erased or overwritten while painting. */
  locked?: boolean
}

export interface LayoutRoom {
  id: string
  name: string
  venue_width: number
  venue_length: number
  booth_width: number
  booth_length: number
  entrance: 'north' | 'south' | 'east' | 'west'
  spacing_mode: LayoutSpacingMode
  /** Event-wide default table length (5 / 6 / 8 / 10 ft) for 1′ grid booth footprints. */
  baseline_table_length_ft?: number | null
  cells: BoothCell[]
  venue_elements: VenueElement[]
  /** Active hall template (locks canvas to preset dimensions when set). */
  venue_preset_id?:
    | 'blank'
    | 'kilkenny'
    | 'delwood'
    | 'strathcona'
    | 'ritchie'
    | 'beverly-heights'
    | 'fulton-place'
    | 'crestwood'
    | 'west-jasper-sherwood'
    | null
  /**
   * Bare-Grid / unmanaged mode: when true, the canvas suspends strict
   * validation rules (perimeter wall enforcement, stroller-aisle
   * clearance, category adjacency, vendor pathfinding) so the
   * coordinator can place, move, and edit objects anywhere on the
   * coordinate field. Walls must be drawn manually in this mode.
   * Stroller / overlap warnings are still surfaced as informational
   * findings — they just no longer *block* placement.
   */
  unmanaged_mode?: boolean
  /**
   * Floor-plan v2 — per-room origin on the unified multi-room canvas
   * (in feet). Each room's local coordinate system runs from
   * `(canvas_origin_x, canvas_origin_y)` to
   * `(canvas_origin_x + venue_width, canvas_origin_y + venue_length)`
   * in the unified canvas frame. Optional / defaults to 0 so any
   * legacy `LayoutRoom` row that predates multi-room layouts keeps
   * rendering at the canvas origin.
   */
  canvas_origin_x?: number
  canvas_origin_y?: number
  /**
   * Vendor layout engine for auto-arrange in this room.
   * `traffic_aware` (default) preserves legacy path optimization;
   * `fairness_first` runs exposure-equity optimization.
   */
  vendor_layout_mode?: 'traffic_aware' | 'fairness_first' | null
}

export interface BoothLayout {
  id: string
  event_id: string
  venue_width: number
  venue_length: number
  booth_width: number
  booth_length: number
  entrance: 'north' | 'south' | 'east' | 'west'
  spacing_mode: LayoutSpacingMode
  cells: BoothCell[]
  venue_elements: VenueElement[]
  layout_rooms?: LayoutRoom[]
  active_room_id?: string | null
  created_at: string
  updated_at: string
}

export interface ShopperFavorite {
  user_id: string
  event_id: string
  created_at: string
}

export interface EventReminder {
  id: string
  user_id: string
  event_id: string
  reminder_offset: ReminderOffset
  remind_at: string
  sent_at: string | null
  sms_sent: boolean
  created_at: string
}

export interface VendorProduct {
  id: string
  vendor_id: string
  name: string
  description: string | null
  image_urls: string[]
  price_min_cents: number | null
  price_max_cents: number | null
  is_featured: boolean
  sold_out: boolean
  flash_sale_until: string | null
  created_at: string
  updated_at: string
}

export interface MarketPreorder {
  id: string
  event_id: string
  vendor_id: string
  shopper_id: string
  product_id: string | null
  quantity: number
  notes: string | null
  status: 'pending' | 'ready' | 'picked_up' | 'cancelled'
  created_at: string
}

export interface EventScheduleItem {
  id: string
  event_id: string
  title: string
  location_label: string | null
  starts_at: string
  ends_at: string | null
  description: string | null
  sort_order: number
  created_at: string
}

export interface VendorFollow {
  user_id: string
  vendor_id: string
  created_at: string
}

export interface CoordinatorFollow {
  user_id: string
  coordinator_id: string
  created_at: string
}

export interface ShopperPurchase {
  id: string
  shopper_id: string
  vendor_id: string
  event_id: string | null
  amount_cents: number
  description: string | null
  square_payment_id: string | null
  purchased_at: string
}

export interface EventReview {
  id: string
  event_id: string
  user_id: string
  rating: number
  comment: string | null
  created_at: string
}

export interface CoordinatorSavedVenue {
  id: string
  coordinator_id: string
  location_name: string
  address: string
  latitude: number
  longitude: number
  venue_preset_id: string | null
  skip_venue_layout: boolean
  market_city: string
  last_used_at: string
  created_at: string
  updated_at: string
}

export interface CoordinatorSavedLayout {
  id: string
  coordinator_id: string
  name: string
  location_name: string
  address: string
  layout_rooms: LayoutRoom[]
  active_room_id: string | null
  is_public: boolean
  last_used_at: string
  created_at: string
  updated_at: string
}

export interface VendorReview {
  id: string
  vendor_id: string
  user_id: string
  event_id: string | null
  rating: number
  comment: string | null
  created_at: string
}

export interface VendorAccessRequest {
  id: string
  shopper_id: string
  coordinator_id: string
  message: string | null
  status: VendorAccessRequestStatus
  rejection_reason: string | null
  reviewed_at: string | null
  created_at: string
}

export interface CoordinatorVendorApproval {
  id: string
  coordinator_id: string
  vendor_user_id: string
  request_id: string | null
  approved_at: string
}

export interface VendorInvitation {
  id: string
  request_id: string
  token: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

export interface MarketFeedback {
  id: string
  user_id: string
  market_id: string
  comment_text: string
  is_addressed: boolean
  context_type: string | null
  context_id: string | null
  created_at: string
  reporter?: Pick<Profile, 'full_name' | 'email' | 'role'>
}

export type FeatureSubmitterRole = 'coordinator' | 'vendor' | 'patron'

export type FeatureImpactLevel = 'nice_to_have' | 'workflow_blocked' | 'critical'

export type FeatureRequestStatus =
  | 'pending'
  | 'under_review'
  | 'planned'
  | 'completed'
  | 'declined'

export interface FeatureRequest {
  id: string
  user_id: string
  session_role: FeatureSubmitterRole
  submitter_role: FeatureSubmitterRole
  title: string
  target_component: string
  problem: string
  dream_solution: string | null
  impact_level: FeatureImpactLevel
  screenshot_url: string | null
  page_path: string | null
  status: FeatureRequestStatus
  developer_notes: string | null
  created_at: string
  updated_at: string
}

export type MarketFeedMediaType = 'image' | 'video'

export interface MarketFeedPost {
  id: string
  event_id: string
  vendor_id: string
  media_url: string
  media_type: MarketFeedMediaType
  caption: string
  likes_count: number
  comments_count: number
  created_at: string
  updated_at: string
}

export interface MarketFeedPostLike {
  post_id: string
  user_id: string
  created_at: string
}

export interface MarketFeedPostComment {
  id: string
  post_id: string
  user_id: string
  body: string
  created_at: string
  author?: Pick<Profile, 'full_name' | 'avatar_url'>
}

export interface AccountBalance {
  coordinator_id: string
  balance_owed: number
  last_invoiced_at: string | null
  updated_at: string
}
