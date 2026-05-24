/**
 * Live layout routing smoke tests — run: npm run test:shopper-routing:live
 * Uses the first published event with a booth_layout in Supabase.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  computeShopperPatronPath,
  getLayoutRooms,
  resolveShopperRouteTrace,
} from '@/lib/shopper/layout'
import { computeExpositionTourRoute, computeVendorDirectRoute } from '@/lib/shopper/pathfinding'
import { patronPathIsWalkable } from '@/lib/booth-planner/patron-path-trace'
import { getRoomCanvasMetrics } from '@/lib/shopper/room-canvas'
import type { BoothLayout, LayoutRoom } from '@/types/database'

function loadEnv() {
  try {
    const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
    }
  } catch {
    /* ignore */
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function verifyRoomRoutes(room: LayoutRoom, eventName: string): void {
  const metrics = getRoomCanvasMetrics(room)
  const placed = metrics.placedCells.length

  const baseline = computeShopperPatronPath(room)
  assert(baseline != null && baseline.points.length >= 2, `${eventName}: baseline patron flow`)
  assert(
    patronPathIsWalkable(baseline!, metrics.venueElements, metrics.canvasRows, metrics.cols),
    `${eventName}: baseline walkability`
  )

  if (placed > 0) {
    const booth = metrics.placedCells[0]
    const vendor = computeVendorDirectRoute(room, booth)
    assert(vendor != null && vendor.points.length >= 2, `${eventName}: vendor direct route`)
    assert(
      patronPathIsWalkable(vendor!, metrics.venueElements, metrics.canvasRows, metrics.cols),
      `${eventName}: vendor route walkability`
    )

    const expo = computeExpositionTourRoute(room)
    assert(expo != null && expo.points.length >= 2, `${eventName}: exposition tour`)
    assert(
      patronPathIsWalkable(expo!, metrics.venueElements, metrics.canvasRows, metrics.cols),
      `${eventName}: exposition walkability`
    )
    assert(
      expo!.points.length > baseline!.points.length,
      `${eventName}: exposition longer than baseline (${expo!.points.length} vs ${baseline!.points.length})`
    )
  }

  assert(resolveShopperRouteTrace(room, 'baseline', null) != null, `${eventName}: resolve baseline`)
  assert(
    resolveShopperRouteTrace(room, 'exposition', null) != null || placed === 0,
    `${eventName}: resolve exposition`
  )
}

export async function runLiveLayoutRoutingQa(): Promise<void> {
  loadEnv()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars in .env.local')

  const supabase = createClient(url, key)
  const eventNameFilter = process.env.SHOPPER_QA_EVENT_NAME ?? 'Market Test 3'

  const query = supabase
    .from('events')
    .select('id, name')
    .in('status', ['published', 'active', 'completed'])
    .ilike('name', `%${eventNameFilter}%`)
    .limit(1)

  const { data: events, error: eventsError } = await query
  if (eventsError) throw eventsError
  assert(events != null && events.length > 0, `No event matching "${eventNameFilter}"`)

  const event = events[0]
  const { data: layoutRow, error: layoutError } = await supabase
    .from('booth_layouts')
    .select('*')
    .eq('event_id', event.id)
    .maybeSingle()

  if (layoutError) throw layoutError
  assert(layoutRow != null, `Event "${event.name}" has no booth_layout`)

  const layout = layoutRow as BoothLayout
  const rooms = getLayoutRooms(layout)
  assert(rooms.length > 0, 'Layout must have at least one room')

  for (const room of rooms) {
    verifyRoomRoutes(room, `${event.name} / ${room.name}`)
  }

  console.log(
    `✓ live layout routing QA passed for "${event.name}" (${rooms.length} room${rooms.length === 1 ? '' : 's'})`
  )
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('qa-live-layout')) {
  runLiveLayoutRoutingQa().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
