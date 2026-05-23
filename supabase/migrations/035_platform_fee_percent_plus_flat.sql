-- ============================================================
-- Migration 035: percent_plus_flat fee mode + payment_required status
-- Enum values must be committed before use (see 035a for defaults).
-- ============================================================

ALTER TYPE platform_fee_mode ADD VALUE IF NOT EXISTS 'percent_plus_flat';

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'payment_required';
