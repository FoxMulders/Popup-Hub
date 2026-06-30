'use client'

import { Suspense, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog'
import { ChangeEmailDialog } from '@/components/profile/change-email-dialog'
import { ConnectedSignInMethods } from '@/components/profile/connected-sign-in-methods'
import { SetPasswordDialog } from '@/components/profile/set-password-dialog'
import {
  fetchUserIdentities,
  hasEmailPasswordIdentity,
} from '@/lib/auth/connected-identities'
import { ChevronDown, KeyRound, Loader2, Mail, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccountSecurityCardProps {
  email: string
}

function AccountSecurityCardInner({ email }: AccountSecurityCardProps) {
  const supabase = createClient()
  const [open, setOpen] = useState(true)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [addPasswordDialogOpen, setAddPasswordDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [hasEmailIdentity, setHasEmailIdentity] = useState<boolean | null>(null)

  useEffect(() => {
    void fetchUserIdentities(supabase).then(({ identities }) => {
      setHasEmailIdentity(hasEmailPasswordIdentity(identities))
    })
  }, [supabase])

  return (
    <>
      <div className="rounded-2xl border bg-white overflow-hidden">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition-colors hover:bg-canvas/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-harvest-400/50"
        >
          <div className="flex items-start gap-3 min-w-0">
            <Shield className="h-5 w-5 text-harvest-600 shrink-0 mt-0.5" aria-hidden />
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground">Account Security</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                Manage sign-in methods, credentials, and account protection.
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
            aria-hidden
          />
        </button>

        {open ? (
          <div className="border-t px-6 py-5 space-y-6">
            <ConnectedSignInMethods />

            <div className="rounded-xl border bg-canvas/50 px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use a strong, unique password. Popup Hub never stores your password in plain text.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="gap-2 h-11 w-full sm:w-auto"
                onClick={() => setEmailDialogOpen(true)}
              >
                <Mail className="h-4 w-4" />
                Change Email
              </Button>
              {hasEmailIdentity === false ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 h-11 w-full sm:w-auto"
                  onClick={() => setAddPasswordDialogOpen(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  Set a password
                </Button>
              ) : hasEmailIdentity === true ? (
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 h-11 w-full sm:w-auto"
                  onClick={() => setPasswordDialogOpen(true)}
                >
                  <KeyRound className="h-4 w-4" />
                  Change Password
                </Button>
              ) : (
                <Button type="button" variant="outline" className="gap-2 h-11" disabled>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </div>

      <ChangeEmailDialog
        currentEmail={email}
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
      />
      <ChangePasswordDialog
        email={email}
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
      />
      <SetPasswordDialog
        email={email}
        open={addPasswordDialogOpen}
        onOpenChange={setAddPasswordDialogOpen}
      />
    </>
  )
}

export function AccountSecurityCard(props: AccountSecurityCardProps) {
  return (
    <Suspense
      fallback={
        <div className="rounded-2xl border bg-white px-6 py-5 text-sm text-muted-foreground">
          Loading account security…
        </div>
      }
    >
      <AccountSecurityCardInner {...props} />
    </Suspense>
  )
}
