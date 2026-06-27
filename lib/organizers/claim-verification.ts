const MIN_VERIFICATION_NOTE_LENGTH = 20

export { MIN_VERIFICATION_NOTE_LENGTH }

export function validateOrganizerClaimVerificationNote(
  note: string | null | undefined
): { ok: true } | { ok: false; error: string } {
  const trimmed = note?.trim() ?? ''
  if (trimmed.length < MIN_VERIFICATION_NOTE_LENGTH) {
    return {
      ok: false,
      error: `Describe how we can verify you run this market (at least ${MIN_VERIFICATION_NOTE_LENGTH} characters).`,
    }
  }
  return { ok: true }
}

export type OrganizerClaimMatchSignal = {
  label: string
  matched: boolean
}

/** Heuristic signals for admin review — not auto-approve. */
export function scoreOrganizerClaimMatch(input: {
  organizerDisplayName: string
  organizerWebsiteUrl?: string | null
  coordinatorOrgName?: string | null
  coordinatorFullName?: string | null
  coordinatorEmail?: string | null
}): OrganizerClaimMatchSignal[] {
  const orgName = input.coordinatorOrgName?.trim().toLowerCase() ?? ''
  const fullName = input.coordinatorFullName?.trim().toLowerCase() ?? ''
  const displayName = input.organizerDisplayName.trim().toLowerCase()
  const emailDomain = input.coordinatorEmail?.split('@')[1]?.toLowerCase() ?? ''
  const websiteHost = (() => {
    const raw = input.organizerWebsiteUrl?.trim()
    if (!raw) return ''
    try {
      const host = new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase()
      return host.replace(/^www\./, '')
    } catch {
      return ''
    }
  })()

  const nameOverlap =
    (orgName.length > 2 && displayName.includes(orgName)) ||
    (orgName.length > 2 && orgName.includes(displayName)) ||
    (fullName.length > 2 && displayName.includes(fullName.split(' ')[0] ?? ''))

  const domainOverlap =
    Boolean(emailDomain && websiteHost) &&
    (emailDomain === websiteHost || emailDomain.endsWith(`.${websiteHost}`) || websiteHost.endsWith(emailDomain))

  return [
    { label: 'Org / display name similarity', matched: nameOverlap },
    { label: 'Email domain matches website', matched: domainOverlap },
  ]
}
