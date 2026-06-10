-- Coordinator toggle: pass card/platform fees to vendors at checkout (gross-up).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS pass_fees_to_vendor BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN events.pass_fees_to_vendor IS
  'When true, gross up card checkout so vendor pays platform fee; coordinator receives full base booth.';

-- Track wallet credit / processor reference when escrow is released.
ALTER TABLE coordinator_escrow_holds
  ADD COLUMN IF NOT EXISTS processor_transfer_id TEXT;

COMMENT ON COLUMN coordinator_escrow_holds.processor_transfer_id IS
  'Wallet transaction id or external processor transfer id when held funds are released.';
