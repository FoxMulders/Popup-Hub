export type CoordinatorOwnerProfile = {
  full_name?: string | null
  coordinator_organization_name?: string | null
  email?: string | null
}

/** Display label for a market owner in admin listings. */
export function formatCoordinatorOwnerLabel(
  profile: CoordinatorOwnerProfile | null | undefined
): string {
  const fullName = profile?.full_name?.trim()
  if (fullName) return fullName

  const orgName = profile?.coordinator_organization_name?.trim()
  if (orgName) return orgName

  const email = profile?.email?.trim()
  if (email) return email

  return 'Unknown organizer'
}
