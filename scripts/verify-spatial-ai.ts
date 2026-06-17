/**
 * Verify spatial AI tier routing, compression, and max_price guardrails.
 * Run: npx tsx scripts/verify-spatial-ai.ts
 */
import { SPATIAL_MAX_PRICE } from '../lib/ai/spatial/max-price'
import {
  compressFloorPlanDoc,
  compressedLayoutToJson,
  compressedLayoutToSvg,
} from '../lib/ai/spatial/compress'
import { routeSpatialTier, routeSpatialWorkload, withFloorProvider } from '../lib/ai/spatial/router'
import { buildOpenRouterPayload } from '../lib/ai/openrouter'
import type { FloorPlanDoc } from '../components/coordinator/floor-plan-v2/state/types'

let passed = 0
let failed = 0

function assert(name: string, condition: boolean) {
  if (condition) {
    passed++
    console.log(`  OK   ${name}`)
  } else {
    failed++
    console.log(`  FAIL ${name}`)
  }
}

const sampleDoc: FloorPlanDoc = {
  canvasWidthFt: 50,
  canvasLengthFt: 40,
  gridSpacingFt: 1,
  snapFt: 1,
  objects: [
    {
      id: 'b1',
      kind: 'booth',
      x: 5,
      y: 5,
      width: 10,
      height: 8,
      rotation: 0,
      categoryName: 'Jewelry',
    },
  ],
  rooms: [{ id: 'r1', name: 'Main Hall', originX: 0, originY: 0, widthFt: 50, lengthFt: 40 }],
  objectRoom: { b1: 'r1' },
}

const compressed = compressFloorPlanDoc(sampleDoc)
assert('compressor strips to minimal tree', compressed.objects[0].b.length === 4)
assert('compressor uses kind shorthand', compressed.objects[0].k === 'b')
assert('compressed JSON is compact', compressedLayoutToJson(compressed).length < 300)
assert('compressed SVG has rect elements', compressedLayoutToSvg(compressed).includes('<rect'))

const vision = routeSpatialTier('vision')
assert('vision tier uses qwen', vision.model.includes('qwen'))
assert('vision price tier is vision', vision.priceTier === 'vision')

const geometry = routeSpatialWorkload('geometry_math')
assert('geometry workload uses floor provider', geometry.usesFloorProvider)
assert('geometry task is spatial_geometry', geometry.task === 'spatial_geometry')

assert('withFloorProvider appends :floor', withFloorProvider('mistralai/mistral-7b-instruct').endsWith(':floor'))
assert('withFloorProvider preserves existing :floor', withFloorProvider('model:floor') === 'model:floor')

const payload = buildOpenRouterPayload({
  model: geometry.model,
  messages: [{ role: 'user', content: 'test' }],
  provider: { max_price: SPATIAL_MAX_PRICE.geometry, sort: 'price' },
})
assert('payload includes max_price guardrail', Boolean((payload.provider as { max_price?: unknown })?.max_price))
assert('geometry max_price caps completion', SPATIAL_MAX_PRICE.geometry.completion <= 1)

console.log('')
if (failed === 0) {
  console.log(`==> ${passed}/${passed} checks passed`)
  process.exit(0)
}

console.log(`==> ${failed} check(s) failed`)
process.exit(1)
