import type { Organizer } from '@/types/organizers'

export type OrganizerClaimMatchReason =
  | 'organization_name_match'
  | 'contact_name_match'
  | 'name_token_match'
  | 'email_domain_match'
  | 'event_name_match'

export interface CoordinatorOrganizerMatchInput {
  fullName: string
  email: string
  organizationName: string | null
  eventNames: string[]
}

export interface OrganizerClaimSuggestion {
  organizerId: string
  slug: string
  displayName: string
  city: string
  province: string
  score: number
  reasons: OrganizerClaimMatchReason[]
}

type OrganizerMatchCandidate = Pick<
  Organizer,
  | 'id'
  | 'slug'
  | 'display_name'
  | 'primary_contact_name'
  | 'city'
  | 'province'
  | 'website_url'
>

const STOP_WORDS = new Set([
  'market',
  'markets',
  'community',
  'makers',
  'maker',
  'fair',
  'fairs',
  'the',
  'and',
  'of',
  'a',
  'an',
  'pop',
  'up',
  'popup',
  'hub',
  'league',
  'hall',
])

export const ORGANIZER_CLAIM_MATCH_MIN_SCORE = 40
export const ORGANIZER_CLAIM_MATCH_MAX_RESULTS = 5

export function normalizeOrganizerMatchText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function organizerMatchTokens(input: string): string[] {
  return normalizeOrganizerMatchText(input)
    .split(' ')
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token))
}

function tokenJaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setA = new Set(a)
  const setB = new Set(b)
  let intersection = 0
  for (const token of setA) {
    if (setB.has(token)) intersection += 1
  }
  const union = new Set([...setA, ...setB]).size
  return union === 0 ? 0 : intersection / union
}

function pushReason(
  reasons: OrganizerClaimMatchReason[],
  reason: OrganizerClaimMatchReason
): void {
  if (!reasons.includes(reason)) reasons.push(reason)
}

function scoreNameOverlap(
  left: string,
  right: string,
  exactScore: number,
  containsScore: number,
  jaccardMultiplier: number,
  reason: OrganizerClaimMatchReason,
  reasons: OrganizerClaimMatchReason[]
): number {
  const leftNorm = normalizeOrganizerMatchText(left)
  const rightNorm = normalizeOrganizerMatchText(right)
  if (!leftNorm || !rightNorm) return 0

  if (leftNorm === rightNorm) {
    pushReason(reasons, reason)
    return exactScore
  }

  if (leftNorm.includes(rightNorm) || rightNorm.includes(leftNorm)) {
    pushReason(reasons, reason)
    return containsScore
  }

  const j = tokenJaccard(organizerMatchTokens(left), organizerMatchTokens(right))
  if (j >= 0.45) {
    pushReason(reasons, reason)
    return Math.round(j * jaccardMultiplier)
  }

  return 0
}

function scoreEmailDomainMatch(
  email: string,
  websiteUrl: string | null,
  reasons: OrganizerClaimMatchReason[]
): number {
  if (!websiteUrl || !email.includes('@')) return 0

  const emailDomain = email.split('@')[1]?.toLowerCase()
  if (!emailDomain || emailDomain.endsWith('gmail.com') || emailDomain.endsWith('hotmail.com')) {
    return 0
  }

  try {
    const url = websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`
    const siteHost = new URL(url).hostname.replace(/^www\./, '').toLowerCase()
    if (siteHost === emailDomain || siteHost.endsWith(`.${emailDomain}`)) {
      pushReason(reasons, 'email_domain_match')
      return 45
    }
  } catch {
    // ignore invalid URLs
  }

  return 0
}

export function scoreOrganizerClaimMatch(
  organizer: OrganizerMatchCandidate,
  input: CoordinatorOrganizerMatchInput
): OrganizerClaimSuggestion | null {
  const reasons: OrganizerClaimMatchReason[] = []
  let score = 0
  const displayTokens = organizerMatchTokens(organizer.display_name)

  if (input.organizationName?.trim()) {
    score += scoreNameOverlap(
      input.organizationName,
      organizer.display_name,
      100,
      78,
      65,
      'organization_name_match',
      reasons
    )
  }

  if (organizer.primary_contact_name?.trim() && input.fullName.trim()) {
    score += scoreNameOverlap(
      input.fullName,
      organizer.primary_contact_name,
      68,
      48,
      42,
      'contact_name_match',
      reasons
    )
  }

  if (input.fullName.trim() && !input.organizationName?.trim()) {
    const fullNameScore = scoreNameOverlap(
      input.fullName,
      organizer.display_name,
      55,
      0,
      30,
      'name_token_match',
      reasons
    )
    if (fullNameScore > 0) score += fullNameScore
  }

  const emailLocal = input.email.split('@')[0]?.replace(/[._+-]/g, ' ') ?? ''
  const emailTokens = organizerMatchTokens(emailLocal)
  if (emailTokens.length > 0) {
    const overlap = emailTokens.filter(
      (token) => token.length >= 4 && displayTokens.includes(token)
    )
    if (overlap.length > 0) {
      pushReason(reasons, 'name_token_match')
      score += 22
    }
  }

  score += scoreEmailDomainMatch(input.email, organizer.website_url, reasons)

  for (const eventName of input.eventNames) {
    const eventScore = scoreNameOverlap(
      eventName,
      organizer.display_name,
      58,
      42,
      48,
      'event_name_match',
      reasons
    )
    if (eventScore > 0) {
      score += eventScore
      break
    }
  }

  if (score < ORGANIZER_CLAIM_MATCH_MIN_SCORE || reasons.length === 0) return null

  return {
    organizerId: organizer.id,
    slug: organizer.slug,
    displayName: organizer.display_name,
    city: organizer.city,
    province: organizer.province,
    score,
    reasons,
  }
}

export function rankOrganizerClaimSuggestions(
  organizers: OrganizerMatchCandidate[],
  input: CoordinatorOrganizerMatchInput
): OrganizerClaimSuggestion[] {
  const ranked = organizers
    .map((organizer) => scoreOrganizerClaimMatch(organizer, input))
    .filter((row): row is OrganizerClaimSuggestion => row != null)
    .sort((a, b) => b.score - a.score)

  const seen = new Set<string>()
  const unique: OrganizerClaimSuggestion[] = []
  for (const row of ranked) {
    if (seen.has(row.organizerId)) continue
    seen.add(row.organizerId)
    unique.push(row)
    if (unique.length >= ORGANIZER_CLAIM_MATCH_MAX_RESULTS) break
  }

  return unique
}

export function organizerClaimMatchReasonLabel(reason: OrganizerClaimMatchReason): string {
  switch (reason) {
    case 'organization_name_match':
      return 'Matches your organization name'
    case 'contact_name_match':
      return 'Matches your contact name'
    case 'name_token_match':
      return 'Similar to your profile name'
    case 'email_domain_match':
      return 'Matches your email domain'
    case 'event_name_match':
      return 'Matches one of your market names'
    default:
      return 'Possible match'
  }
}
