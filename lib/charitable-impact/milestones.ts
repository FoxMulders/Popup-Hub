export interface CharityMilestone {
  amountCents: number
  label: string
}

/** Default community goals when event has no custom milestones configured. */
export const DEFAULT_CHARITY_MILESTONES: CharityMilestone[] = [
  { amountCents: 50_000, label: 'Community Garden Beds' },
  { amountCents: 100_000, label: 'Local Youth Supplies' },
  { amountCents: 250_000, label: 'Neighborhood Food Pantry' },
  { amountCents: 500_000, label: 'After-School Arts Program' },
]

export interface CharityImpactProgress {
  totalCents: number
  totalDollars: number
  milestones: CharityMilestone[]
  achievedMilestones: CharityMilestone[]
  nextMilestone: CharityMilestone | null
  previousThresholdCents: number
  /** Progress toward the next milestone (0–100). */
  progressToNext: number
  /** Dollars remaining until the next milestone. */
  dollarsToNext: number
  /** All milestones reached. */
  isComplete: boolean
}

export function parseCharityMilestones(raw: unknown): CharityMilestone[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_CHARITY_MILESTONES
  }

  const parsed: CharityMilestone[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as { amount_cents?: number; amountCents?: number; label?: string }
    const amountCents = row.amount_cents ?? row.amountCents
    const label = row.label?.trim()
    if (typeof amountCents === 'number' && amountCents > 0 && label) {
      parsed.push({ amountCents: Math.round(amountCents), label })
    }
  }

  if (parsed.length === 0) return DEFAULT_CHARITY_MILESTONES
  return [...parsed].sort((a, b) => a.amountCents - b.amountCents)
}

export function computeCharityImpactProgress(
  totalCents: number,
  milestones: CharityMilestone[]
): CharityImpactProgress {
  const sorted = [...milestones].sort((a, b) => a.amountCents - b.amountCents)
  const safeTotal = Math.max(0, totalCents)
  const achievedMilestones = sorted.filter((m) => safeTotal >= m.amountCents)
  const nextMilestone = sorted.find((m) => safeTotal < m.amountCents) ?? null
  const previousThresholdCents =
    achievedMilestones.length > 0
      ? achievedMilestones[achievedMilestones.length - 1].amountCents
      : 0

  let progressToNext = 100
  let dollarsToNext = 0

  if (nextMilestone) {
    const span = nextMilestone.amountCents - previousThresholdCents
    const current = safeTotal - previousThresholdCents
    progressToNext = span > 0 ? Math.min(100, Math.max(0, (current / span) * 100)) : 0
    dollarsToNext = Math.max(0, (nextMilestone.amountCents - safeTotal) / 100)
  }

  return {
    totalCents: safeTotal,
    totalDollars: safeTotal / 100,
    milestones: sorted,
    achievedMilestones,
    nextMilestone,
    previousThresholdCents,
    progressToNext,
    dollarsToNext,
    isComplete: !nextMilestone && sorted.length > 0 && safeTotal >= sorted[sorted.length - 1].amountCents,
  }
}

export function formatImpactDollars(cents: number): string {
  const dollars = cents / 100
  if (dollars >= 1000) {
    return `$${dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
  }
  return `$${dollars.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export function impactHeadline(progress: CharityImpactProgress): string {
  if (progress.isComplete) {
    const last = progress.achievedMilestones[progress.achievedMilestones.length - 1]
    return last
      ? `Together we fully funded ${last.label}!`
      : 'Every community milestone has been reached!'
  }

  if (!progress.nextMilestone) {
    return `Community impact: ${formatImpactDollars(progress.totalCents)} raised so far`
  }

  const away =
    progress.dollarsToNext >= 1000
      ? `$${Math.ceil(progress.dollarsToNext).toLocaleString()}`
      : `$${progress.dollarsToNext.toFixed(0)}`

  return `We are ${away} away from funding ${progress.nextMilestone.label}!`
}

const CELEBRATED_STORAGE_PREFIX = 'popup-hub:charity-milestones:'

export function readCelebratedMilestones(eventId: string): Set<number> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(`${CELEBRATED_STORAGE_PREFIX}${eventId}`)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as number[]
    return new Set(parsed.filter((n) => typeof n === 'number'))
  } catch {
    return new Set()
  }
}

export function markMilestoneCelebrated(eventId: string, amountCents: number): void {
  if (typeof window === 'undefined') return
  try {
    const existing = readCelebratedMilestones(eventId)
    existing.add(amountCents)
    localStorage.setItem(
      `${CELEBRATED_STORAGE_PREFIX}${eventId}`,
      JSON.stringify([...existing])
    )
  } catch {
    /* ignore quota */
  }
}

export function findNewlyAchievedMilestones(
  progress: CharityImpactProgress,
  alreadyCelebrated: Set<number>
): CharityMilestone[] {
  return progress.achievedMilestones.filter((m) => !alreadyCelebrated.has(m.amountCents))
}
