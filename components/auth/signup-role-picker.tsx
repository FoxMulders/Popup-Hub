'use client'

import { Calendar, ShoppingBag, Store } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { type SignupRole } from '@/lib/auth/rbac'
import { VendorSignupPassportPreview } from '@/components/marketing/vendor-signup-passport-preview'
import { SignupRoleQuestionnaire } from '@/components/auth/signup-role-questionnaire'

export const SIGNUP_ROLE_OPTIONS = [
  {
    id: 'shopper' as SignupRole,
    label: 'Patron',
    subtitle: null as string | null,
    desc: 'Discover markets, maps & favorites',
    includes: null as string | null,
    bestFor: 'You mainly browse and shop at markets',
    icon: ShoppingBag,
    contextBullets: [
      'Browse markets and vendor maps',
      'Save favorites and get reminders',
      'Participate in quarter auctions',
    ],
  },
  {
    id: 'vendor' as SignupRole,
    label: 'Vendor',
    subtitle: null,
    desc: 'Apply for booths — juried markets review each application',
    includes: 'Includes Patron access',
    bestFor: 'You sell goods or services at pop-up markets',
    icon: Store,
    contextBullets: [
      'Build a reusable vendor passport',
      'Apply to open and juried markets',
      'Browse and shop as a patron too',
    ],
  },
  {
    id: 'coordinator' as SignupRole,
    label: 'Coordinator',
    subtitle: 'market organizer',
    desc: 'Create events, review vendors & run market day',
    includes: 'Includes Vendor & Patron access',
    bestFor: 'You run or host pop-up and makers markets',
    icon: Calendar,
    contextBullets: [
      'Create events and manage applications',
      'Layout booths in HubGrid and run check-in',
      'Vend and browse as a patron when needed',
    ],
  },
] as const

export { getSignupRoleLabel } from '@/lib/auth/signup-role-questionnaire'

interface SignupRolePickerProps {
  role: SignupRole
  onRoleChange: (role: SignupRole) => void
  roleLocked?: boolean
}

function RoleContextPanel({ role }: { role: SignupRole }) {
  const option = SIGNUP_ROLE_OPTIONS.find((item) => item.id === role)
  if (!option) return null

  return (
    <div className="rounded-xl border border-stone-200/80 bg-canvas/40 px-3 py-3 text-sm">
      <p className="font-medium text-foreground">
        {option.label}
        {option.subtitle ? (
          <span className="font-normal text-muted-foreground"> ({option.subtitle})</span>
        ) : null}
      </p>
      {option.includes ? (
        <p className="mt-1 text-xs font-medium text-harvest-700">{option.includes}</p>
      ) : null}
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {option.contextBullets.map((bullet) => (
          <li key={bullet} className="flex gap-1.5">
            <span aria-hidden className="text-harvest-500">
              ·
            </span>
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SignupRolePicker({ role, onRoleChange, roleLocked = false }: SignupRolePickerProps) {
  const selectedOption = SIGNUP_ROLE_OPTIONS.find((option) => option.id === role)

  if (roleLocked) {
    return (
      <div className="mb-6 space-y-4">
        <div className="flex justify-center">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
            {role === 'coordinator' ? (
              <Calendar className="h-4 w-4" aria-hidden />
            ) : role === 'vendor' ? (
              <Store className="h-4 w-4" aria-hidden />
            ) : (
              <ShoppingBag className="h-4 w-4" aria-hidden />
            )}
            Signing up as {selectedOption?.label ?? role}
          </Badge>
        </div>
        <RoleContextPanel role={role} />
        {role === 'vendor' ? <VendorSignupPassportPreview /> : null}
        <div className="flex justify-center">
          <SignupRoleQuestionnaire
            onSelectRole={onRoleChange}
            allowApply={false}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="rounded-xl border border-sage-200/80 bg-sage-50/40 px-3 py-3 text-xs leading-relaxed text-muted-foreground">
        <p className="font-medium text-foreground">
          Choose the account that matches your primary job on Popup Hub.
        </p>
        <p className="mt-1.5">
          Vendor accounts also include Patron access. Coordinator accounts include Vendor and Patron
          access.
        </p>
        <p className="mt-1.5">
          Pick the <strong className="font-semibold text-foreground">highest</strong> role you need.
          Vendor → Coordinator upgrades require support.
        </p>
      </div>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">I am a… *</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SIGNUP_ROLE_OPTIONS.map(({ id, label, subtitle, desc, includes, bestFor, icon: Icon }) => {
            const selected = role === id
            return (
              <label
                key={id}
                className={`flex min-h-[5.5rem] cursor-pointer touch-manipulation flex-col items-center rounded-xl border p-3 text-center transition ${
                  selected
                    ? 'border-harvest-500 bg-harvest-50 ring-2 ring-harvest-200/80'
                    : 'border-stone-200/80 hover:border-harvest-400/60 hover:bg-canvas/50'
                }`}
              >
                <input
                  type="radio"
                  name="signup-role"
                  value={id}
                  checked={selected}
                  onChange={() => onRoleChange(id)}
                  className="sr-only"
                  required
                />
                <Icon
                  className={`mb-1.5 h-5 w-5 ${selected ? 'text-harvest-600' : 'text-muted-foreground'}`}
                />
                <span className="text-xs font-semibold">{label}</span>
                {subtitle ? (
                  <span className="text-[10px] text-muted-foreground">({subtitle})</span>
                ) : null}
                <span className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{desc}</span>
                {includes ? (
                  <span className="mt-1 text-[10px] font-medium text-harvest-700">{includes}</span>
                ) : null}
                <span className="mt-1 text-[10px] italic text-muted-foreground/90">{bestFor}</span>
              </label>
            )
          })}
        </div>
      </fieldset>

      <RoleContextPanel role={role} />
      {role === 'vendor' ? <VendorSignupPassportPreview /> : null}

      <div className="flex justify-center">
        <SignupRoleQuestionnaire onSelectRole={onRoleChange} allowApply />
      </div>
    </div>
  )
}
