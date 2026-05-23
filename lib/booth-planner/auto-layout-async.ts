import {
  autoLayout,
  createAutoLayoutSession,
  type AutoLayoutParams,
  type AutoLayoutResult,
} from '@/lib/booth-planner/algorithm'
import { nextAnimationFrame } from '@/lib/booth-planner/placement-guard'

export interface AutoLayoutAsyncOptions {
  /** Vendors to attempt per animation frame (default 3). */
  vendorsPerFrame?: number
  signal?: AbortSignal
  /** Immediate cancel gate — checked before each batch. */
  isCancelled?: () => boolean
  onProgress?: (result: AutoLayoutResult) => void
}

const DEFAULT_VENDORS_PER_FRAME = 3

/**
 * Frame-split auto-plan — yields to the browser between vendor batches so the UI stays responsive.
 */
export async function autoLayoutAsync(
  params: AutoLayoutParams,
  options: AutoLayoutAsyncOptions = {}
): Promise<AutoLayoutResult> {
  const vendorsPerFrame = options.vendorsPerFrame ?? DEFAULT_VENDORS_PER_FRAME
  const session = createAutoLayoutSession(params, { stopOnOverlap: true })

  while (!session.isDone) {
    if (options.signal?.aborted || options.isCancelled?.()) {
      break
    }

    await nextAnimationFrame()

    if (options.signal?.aborted || options.isCancelled?.()) {
      break
    }

    session.tick(vendorsPerFrame)
    options.onProgress?.(session.getResult())

    if (session.hasStoppedOnOverlap || session.hasIterationLimitHit) {
      break
    }
  }

  return session.getResult()
}

export { autoLayout, createAutoLayoutSession }
