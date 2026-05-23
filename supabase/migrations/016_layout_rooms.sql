-- Multi-room / multi-zone booth layouts (each room has its own grid + fixtures)

ALTER TABLE booth_layouts
  ADD COLUMN IF NOT EXISTS layout_rooms JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS active_room_id TEXT;

COMMENT ON COLUMN booth_layouts.layout_rooms IS
  'Array of layout zones: id, name, venue dimensions, cells, venue_elements, spacing per room.';
COMMENT ON COLUMN booth_layouts.active_room_id IS
  'ID of the room last edited in the planner; top-level columns mirror this room for legacy consumers.';
