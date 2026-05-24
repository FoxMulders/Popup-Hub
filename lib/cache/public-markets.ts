import { revalidateTag } from 'next/cache'
import { PUBLIC_MARKETS_CACHE_TAG } from '@/lib/queries/cached-public-markets'

/** Bust cached discover map, vendor directory, and vendor count reads. */
export function revalidatePublicMarketsCache(): void {
  revalidateTag(PUBLIC_MARKETS_CACHE_TAG, 'max')
}
