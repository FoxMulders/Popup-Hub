export type PaddleChipTier = 'white' | 'green'

export const PADDLE_POOL_MAX = 200
export const PADDLE_POOL_MIN = 1
export const DEFAULT_PADDLE_POOL_SIZE = 200

export function clampPoolSize(size: number): number {
  return Math.min(PADDLE_POOL_MAX, Math.max(PADDLE_POOL_MIN, Math.floor(size)))
}

/** Plain paddle number for storage and display (e.g. 7, not 007). */
export function formatPaddleNumber(value: number, poolSize: number): string {
  const n = Math.floor(value)
  if (n < 1 || n > clampPoolSize(poolSize)) return String(n)
  return String(n)
}

export function parsePaddleNumber(raw: string | number, poolSize: number): number | null {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw).trim(), 10)
  if (!Number.isFinite(n) || n < 1 || n > clampPoolSize(poolSize)) return null
  return n
}

export function paddleChipTier(number: number): PaddleChipTier {
  return number <= 100 ? 'white' : 'green'
}

export function poolNumbers(poolSize: number): number[] {
  const size = clampPoolSize(poolSize)
  return Array.from({ length: size }, (_, i) => i + 1)
}

/** Suggest pool size from expected headcount (cap 200). */
export function suggestPoolSize(expectedParticipants: number | null | undefined): number {
  if (expectedParticipants == null || expectedParticipants < 1) return DEFAULT_PADDLE_POOL_SIZE
  return clampPoolSize(Math.ceil(expectedParticipants * 1.1))
}
