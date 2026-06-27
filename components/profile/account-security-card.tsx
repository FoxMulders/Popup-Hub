'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChangePasswordDialog } from '@/components/profile/change-password-dialog'
import { ChangeEmailDialog } from '@/components/profile/change-email-dialog'
import { ChevronDown, KeyRound, Mail, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AccountSecurityCardProps {
  email: string
}

export function AccountSecurityCard({ email }: AccountSecurityCardProps) {
  const [open, setOpen] = useState(false)
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

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
                Manage sign-in credentials and protect your account.
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
          <div className="border-t px-6 py-5 space-y-4">
            <div className="rounded-xl border bg-canvas/50 px-4 py-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Use a strong, unique password. Popup Hub never stores your password in plain text.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="gap-2 h-11 w-full sm:w-auto"
              onClick={() => setEmailDialogOpen(true)}
            >
              <Mail className="h-4 w-4" />
              Change Email
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2 h-11 w-full sm:w-auto"
              onClick={() => setPasswordDialogOpen(true)}
            >
              <KeyRound className="h-4 w-4" />
              Change Password
            </Button>
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
    </>
  )
}
