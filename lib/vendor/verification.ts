import type { VendorAccountStatus, VendorPassport, VendorVerificationStatus } from '@/types/database'

export const RISK_SCORE_BLOCK_THRESHOLD = 75

export type VendorVerificationInput = {
  business_number?: string | null
  social_handle?: string | null
  business_name?: string | null
  instagram_url?: string | null
  is_verified?: boolean
  verification_status?: VendorVerificationStatus
}

export type BusinessNumberValidation = {
  ok: boolean
  normalized: string | null
  error?: string
}

export type SocialHandleValidation = {
  ok: boolean
  normalized: string | null
  error?: string
}

/** Canadian BN / US EIN-style format checks — external registry lookup is stubbed. */
export function validateBusinessNumber(raw: string | null | undefined): BusinessNumberValidation {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return { ok: false, normalized: null, error: 'Business number is required for verification.' }
  }

  const compact = trimmed.replace(/[\s-]/g, '').toUpperCase()
  const bnPattern = /^\d{9}(RC\d{4})?$/i
  const einPattern = /^\d{2}-?\d{7}$/

  if (bnPattern.test(compact) || einPattern.test(trimmed)) {
    return { ok: true, normalized: compact }
  }

  if (compact.length >= 6 && compact.length <= 20 && /^[A-Z0-9]+$/.test(compact)) {
    return { ok: true, normalized: compact }
  }

  return {
    ok: false,
    normalized: null,
    error: 'Enter a valid business registration or tax ID (e.g. 123456789 or 12-3456789).',
  }
}

export function validateSocialHandle(raw: string | null | undefined): SocialHandleValidation {
  const trimmed = raw?.trim() ?? ''
  if (!trimmed) {
    return { ok: false, normalized: null, error: 'Social handle is required for verification.' }
  }

  const fromUrl = trimmed.match(/(?:instagram\.com|tiktok\.com)\/(@?[\w.]+)/i)?.[1]
  const candidate = fromUrl ?? trimmed
  const normalized = candidate.replace(/^@/, '').toLowerCase()

  if (!/^[a-z0-9._]{2,30}$/.test(normalized)) {
    return {
      ok: false,
      normalized: null,
      error: 'Enter a valid handle (letters, numbers, dots, underscores).',
    }
  }

  return { ok: true, normalized: `@${normalized}` }
}

/**
 * Stub cross-check — placeholder for external business registry / social API.
 * Returns a small risk bump when formats match but registry lookup is unavailable.
 */
export async function crossCheckVendorIdentity(input: {
  socialHandle: string
  businessName?: string | null
}): Promise<{ externalRiskDelta: number; notes: string[] }> {
  const notes: string[] = []
  let externalRiskDelta = 0

  if (!input.socialHandle) {
    externalRiskDelta += 15
    notes.push('missing_identity_fields')
  }

  // Placeholder: future integration with registry / social graph APIs
  notes.push('external_registry_stub')

  if (input.businessName && input.businessName.length < 3) {
    externalRiskDelta += 10
    notes.push('short_business_name')
  }

  return { externalRiskDelta, notes }
}

export function computeRiskScore(input: VendorVerificationInput): number {
  let score = 0

  const bnProvided = Boolean(input.business_number?.trim())
  const bn = bnProvided
    ? validateBusinessNumber(input.business_number)
    : { ok: true, normalized: null as string | null }
  const handle = validateSocialHandle(input.social_handle ?? socialHandleFromInstagram(input.instagram_url))

  if (bnProvided && !bn.ok) score += 35
  if (!handle.ok) score += 25

  if (input.verification_status === 'rejected') score += 50
  if (input.verification_status === 'verified' || input.is_verified) score = Math.max(0, score - 30)

  return Math.min(100, Math.max(0, score))
}

function socialHandleFromInstagram(instagramUrl: string | null | undefined): string | null {
  if (!instagramUrl?.trim()) return null
  const match = instagramUrl.match(/instagram\.com\/(@?[\w.]+)/i)
  return match?.[1] ?? null
}

export type VendorFraudGate = Pick<
  VendorPassport,
  'risk_score' | 'verification_status' | 'account_status' | 'business_number' | 'social_handle'
>

export function isHighRiskVendor(passport: VendorFraudGate | null | undefined): boolean {
  return (passport?.risk_score ?? 0) > RISK_SCORE_BLOCK_THRESHOLD
}

export function isVendorAccountBlocked(passport: VendorFraudGate | null | undefined): boolean {
  const status = passport?.account_status ?? 'active'
  return status === 'suspended' || status === 'banned'
}

export function vendorApplyBlockReason(passport: VendorFraudGate | null | undefined): string | null {
  if (!passport) {
    return 'Complete your Vendor Passport before applying to markets.'
  }
  if (isVendorAccountBlocked(passport)) {
    return 'Your vendor account is suspended. Contact support to resolve payment or verification issues.'
  }
  if (passport.verification_status === 'rejected') {
    return 'Your identity verification was rejected. Update your passport and contact the coordinator.'
  }
  if (isHighRiskVendor(passport)) {
    return 'Your account requires additional verification before applying to markets.'
  }

  const handle = validateSocialHandle(passport.social_handle)
  if (!handle.ok) {
    return 'Add a valid social handle to your Vendor Passport before applying.'
  }

  return null
}

export function vendorBoothBlockReason(passport: VendorFraudGate | null | undefined): string | null {
  if (isVendorAccountBlocked(passport)) {
    return 'Vendor account is suspended — booth assignment blocked.'
  }
  if (isHighRiskVendor(passport)) {
    return 'Vendor risk score too high — booth assignment blocked.'
  }
  return null
}

export async function evaluateAndScoreVendorPassport(input: VendorVerificationInput): Promise<{
  risk_score: number
  verification_status: VendorVerificationStatus
  business_number: string | null
  social_handle: string | null
}> {
  const bnProvided = Boolean(input.business_number?.trim())
  const bn = bnProvided
    ? validateBusinessNumber(input.business_number)
    : { ok: true, normalized: null as string | null }
  const handle = validateSocialHandle(
    input.social_handle ?? socialHandleFromInstagram(input.instagram_url)
  )

  let risk = computeRiskScore({
    ...input,
    business_number: bn.normalized,
    social_handle: handle.normalized,
  })

  if (handle.ok && handle.normalized) {
    const cross = await crossCheckVendorIdentity({
      socialHandle: handle.normalized,
      businessName: input.business_name,
    })
    risk = Math.min(100, risk + cross.externalRiskDelta)
  }

  let verification_status: VendorVerificationStatus = input.verification_status ?? 'unverified'
  if (input.is_verified || input.verification_status === 'verified') {
    verification_status = 'verified'
  } else if (handle.ok && (!bnProvided || bn.ok) && risk <= RISK_SCORE_BLOCK_THRESHOLD) {
    verification_status = 'pending'
  }

  return {
    risk_score: risk,
    verification_status,
    business_number: bn.normalized,
    social_handle: handle.normalized,
  }
}
