export type DevMockRole = 'coordinator' | 'vendor' | 'shopper'

export const DEV_MOCK_ROLE_PARAM = 'mock_role'

/** Kilkenny test event — use only when mock coordinator creds match the event owner. */
export const DEV_MOCK_COORDINATOR_EVENT_PATH =
  '/coordinator/events/4e87e086-da8e-4e46-af11-b1e7322f4e65'

function devMockCoordinatorRedirectTo(): string {
  const email = process.env.DEV_MOCK_COORDINATOR_EMAIL?.toLowerCase()
  if (email === 'coordinator@me.com') {
    return DEV_MOCK_COORDINATOR_EVENT_PATH
  }
  if (email === 'coordinator@coordinator.dev') {
    return '/coordinator'
  }
  return DEV_MOCK_COORDINATOR_EVENT_PATH
}

export function isDevMockAuthEnabled(): boolean {
  return process.env.NODE_ENV === 'development'
}

export function parseDevMockRole(value: string | null | undefined): DevMockRole | null {
  if (value === 'coordinator' || value === 'vendor' || value === 'shopper') {
    return value
  }
  return null
}

export interface DevMockRoleConfig {
  label: string
  redirectTo: string
  email?: string
  password?: string
  /** When true, clear session and browse as signed-out patron. */
  anonymous?: boolean
}

export function devMockRoleConfig(role: DevMockRole): DevMockRoleConfig {
  switch (role) {
    case 'coordinator':
      return {
        label: 'Coordinator',
        redirectTo: devMockCoordinatorRedirectTo(),
        email: process.env.DEV_MOCK_COORDINATOR_EMAIL,
        password: process.env.DEV_MOCK_COORDINATOR_PASSWORD,
      }
    case 'vendor':
      return {
        label: 'Vendor',
        redirectTo: '/vendor/dashboard',
        email: process.env.DEV_MOCK_VENDOR_EMAIL,
        password: process.env.DEV_MOCK_VENDOR_PASSWORD,
      }
    case 'shopper':
      return {
        label: 'Patron',
        redirectTo: '/discover',
        email: process.env.DEV_MOCK_SHOPPER_EMAIL,
        password: process.env.DEV_MOCK_SHOPPER_PASSWORD,
        anonymous: !process.env.DEV_MOCK_SHOPPER_EMAIL,
      }
  }
}

export function devMockLoginPath(role: DevMockRole): string {
  return `/api/dev/mock-login?role=${role}`
}

export function loginWithMockRolePath(role: DevMockRole): string {
  return `/login?${DEV_MOCK_ROLE_PARAM}=${role}`
}
