import type { ApplicationStatus } from '@/types/database'

export type CategoryRosterPerson = {
  applicationId: string
  vendorName: string
  status: ApplicationStatus
  waitlistPosition: number | null
}

export type CategoryRoster = {
  signedUp: CategoryRosterPerson[]
  waitlist: CategoryRosterPerson[]
}

export type CategoryRosterApplication = {
  id: string
  category_id: string
  status: ApplicationStatus
  waitlist_position: number | null
  vendor?: { full_name?: string | null; email?: string | null } | null
}

function vendorDisplayName(app: CategoryRosterApplication): string {
  const name = app.vendor?.full_name?.trim()
  if (name) return name
  const email = app.vendor?.email?.trim()
  if (email) return email
  return 'Unknown vendor'
}

/** Approved / insurance-pending vendors in a category plus waitlisted applicants. */
export function rosterForCategory(
  categoryId: string,
  applications: ReadonlyArray<CategoryRosterApplication>
): CategoryRoster {
  const signedUp: CategoryRosterPerson[] = []
  const waitlist: CategoryRosterPerson[] = []

  for (const app of applications) {
    if (app.category_id !== categoryId) continue
    const person: CategoryRosterPerson = {
      applicationId: app.id,
      vendorName: vendorDisplayName(app),
      status: app.status,
      waitlistPosition: app.waitlist_position,
    }
    if (app.status === 'approved' || app.status === 'pending_insurance') {
      signedUp.push(person)
    } else if (app.status === 'waitlisted') {
      waitlist.push(person)
    }
  }

  signedUp.sort((a, b) => a.vendorName.localeCompare(b.vendorName))
  waitlist.sort(
    (a, b) =>
      (a.waitlistPosition ?? Number.MAX_SAFE_INTEGER) -
      (b.waitlistPosition ?? Number.MAX_SAFE_INTEGER)
  )

  return { signedUp, waitlist }
}
