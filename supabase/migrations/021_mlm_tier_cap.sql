-- Collective MLM tier cap for FCFS curation (per-brand slots remain capped at 1 in app logic).

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_mlm_slots INTEGER
    CHECK (max_mlm_slots IS NULL OR max_mlm_slots >= 0);

COMMENT ON COLUMN events.max_mlm_slots IS
  'Maximum total MLM booth slots across all direct-sales brands at this event.';
