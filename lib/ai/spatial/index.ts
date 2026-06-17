export {
  compressFloorPlanDoc,
  compressRoomLayout,
  compressedLayoutToJson,
  compressedLayoutToSvg,
  type CompressedLayout,
  type CompressedObject,
  type CompressedRect,
  type CompressedRoom,
} from '@/lib/ai/spatial/compress'

export { SPATIAL_MAX_PRICE, type OpenRouterMaxPrice, type SpatialPriceTier } from '@/lib/ai/spatial/max-price'

export {
  routeSpatialTier,
  routeSpatialWorkload,
  withFloorProvider,
  type SpatialModelRoute,
  type SpatialTier,
} from '@/lib/ai/spatial/router'

export {
  consultSpatialAdvisor,
  shouldEscalateToAdvisor,
  type SpatialAdvisorInput,
  type SpatialAdvisorResult,
  type SpatialCollisionIssue,
} from '@/lib/ai/spatial/advisor'

export {
  createLayoutSseStream,
  parseStreamedLayoutJson,
  processLayoutStreamDelta,
  type ParsedStreamingLayout,
  type StreamingLayoutChunk,
} from '@/lib/ai/spatial/stream'

export {
  openRouterSpatialChat,
  openRouterSpatialLayoutStream,
  type SpatialChatInput,
  type SpatialChatResult,
} from '@/lib/ai/spatial/client'
