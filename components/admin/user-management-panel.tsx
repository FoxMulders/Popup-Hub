'use client'

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { ExternalLink, Loader2, Search, AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/toast'
import { roleDisplayLabel } from '@/lib/auth/account-access'
import { COORDINATOR_STUDIO_PATH } from '@/lib/coordinator/coordinator-routes'
import { ROLE_LEVEL } from '@/lib/auth/rbac'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { AdminUserSearchResult } from '@/lib/admin/user-search'
import type { AdminUserDetail } from '@/lib/admin/user-detail'
import type { Role } from '@/types/database'
import { cn } from '@/lib/utils'

type ConfirmAction =
  | { type: 'set_role'; role: Role }
  | { type: 'set_admin'; value: boolean }
  | { type: 'ban_auth' }
  | { type: 'resolve_duplicate'; keepUserId: string; deleteUserId: string; keepLabel: string }
  | { type: 'coordinator'; action: 'approve' | 'reject' | 'suspend' | 'reinstate' | 'ban' }

const ROLES: Role[] = ['shopper', 'vendor', 'coordinator']

function formatDate(value: string | null): string {
  if (!value) return '—'
  try {
    return formatDistanceToNow(new Date(value), { addSuffix: true })
  } catch {
    return value
  }
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export function UserManagementPanel() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<AdminUserSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminUserDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [draftRole, setDraftRole] = useState<Role>('shopper')
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([])
      return
    }

    setSearchLoading(true)
    const res = await fetch(`/api/admin/users?q=${encodeURIComponent(q)}`)
    setSearchLoading(false)

    if (!res.ok) {
      toast.error('Could not search users')
      return
    }

    const json = (await res.json()) as { users?: AdminUserSearchResult[] }
    setResults(json.users ?? [])
  }, [])

  useEffect(() => {
    void runSearch(debouncedQuery)
  }, [debouncedQuery, runSearch])

  const loadDetail = useCallback(async (userId: string) => {
    setDetailLoading(true)
    const res = await fetch(`/api/admin/users/${userId}`)
    setDetailLoading(false)

    if (!res.ok) {
      toast.error('Could not load user details')
      return
    }

    const json = (await res.json()) as { user?: AdminUserDetail }
    if (json.user) {
      setDetail(json.user)
      setDraftRole(json.user.role)
    }
  }, [])

  useEffect(() => {
    if (selectedId) {
      void loadDetail(selectedId)
    } else {
      setDetail(null)
    }
  }, [selectedId, loadDetail])

  const isRoleDemotion = useMemo(() => {
    if (!detail) return false
    return ROLE_LEVEL[draftRole] < ROLE_LEVEL[detail.role]
  }, [detail, draftRole])

  async function postAction(body: Record<string, unknown>, targetUserId = selectedId) {
    if (!targetUserId) return false

    const res = await fetch(`/api/admin/users/${targetUserId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const json = (await res.json().catch(() => ({}))) as { error?: string; message?: string }

    if (!res.ok) {
      toast.error(json.error ?? 'Action failed')
      return false
    }

    toast.success(json.message ?? 'Updated')
    await loadDetail(selectedId ?? targetUserId)
    if (debouncedQuery.length >= 2) {
      void runSearch(debouncedQuery)
    }
    return true
  }

  async function postCoordinatorAction(action: ConfirmAction & { type: 'coordinator' }) {
    if (!selectedId) return false

    const res = await fetch('/api/admin/coordinator-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinatorId: selectedId, action: action.action }),
    })

    const json = (await res.json().catch(() => ({}))) as { error?: string }

    if (!res.ok) {
      toast.error(json.error ?? 'Coordinator action failed')
      return false
    }

    toast.success(`Coordinator ${action.action}`)
    await loadDetail(selectedId)
    return true
  }

  function handleConfirm() {
    if (!confirmAction) return

    startTransition(async () => {
      let ok = false

      if (confirmAction.type === 'coordinator') {
        ok = await postCoordinatorAction(confirmAction)
      } else if (confirmAction.type === 'set_role') {
        ok = await postAction({ action: 'set_role', role: confirmAction.role })
      } else if (confirmAction.type === 'set_admin') {
        ok = await postAction({ action: 'set_admin', value: confirmAction.value })
      } else if (confirmAction.type === 'ban_auth') {
        ok = await postAction({ action: 'ban_auth' })
      } else if (confirmAction.type === 'resolve_duplicate') {
        ok = await postAction(
          {
            action: 'resolve_duplicate',
            keepUserId: confirmAction.keepUserId,
          },
          confirmAction.deleteUserId
        )
        if (ok) {
          setSelectedId(confirmAction.keepUserId)
        }
      }

      if (ok) setConfirmAction(null)
    })
  }

  function saveRole() {
    if (!detail || draftRole === detail.role) return

    if (isRoleDemotion) {
      setConfirmAction({ type: 'set_role', role: draftRole })
      return
    }

    startTransition(async () => {
      await postAction({ action: 'set_role', role: draftRole })
    })
  }

  function toggleFlag(action: 'set_beta_tester' | 'set_wallet_blocked', value: boolean) {
    startTransition(async () => {
      await postAction({ action, value })
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email, name, user ID, or wallet paddle…"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {searchLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Searching…
        </p>
      ) : null}

      {!searchLoading && debouncedQuery.length >= 2 && results.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          No users matched &ldquo;{debouncedQuery}&rdquo;.
        </p>
      ) : null}

      {debouncedQuery.length < 2 && !selectedId ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Enter at least 2 characters to search users.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="grid gap-2 lg:grid-cols-2">
          {results.map((row) => (
            <li key={row.id}>
              <button
                type="button"
                onClick={() => setSelectedId(row.id)}
                className={cn(
                  'w-full rounded-xl border bg-card p-4 text-left transition-colors hover:bg-muted/40',
                  selectedId === row.id && 'border-primary ring-1 ring-primary/30'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      {row.full_name || row.email || 'Unnamed user'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{row.email ?? row.id}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline">{roleDisplayLabel(row.role)}</Badge>
                    {row.is_admin ? <Badge>Admin</Badge> : null}
                    {row.is_beta_tester ? <Badge variant="secondary">Beta</Badge> : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Joined {formatDate(row.created_at)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedId ? (
        <div className="rounded-xl border bg-card p-4 lg:p-6">
          {detailLoading && !detail ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading user…
            </p>
          ) : detail ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="space-y-3">
                <h3 className="font-heading text-lg font-semibold text-foreground">Account</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Email</dt>
                    <dd className="font-medium">{detail.email ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Name</dt>
                    <dd className="font-medium">{detail.full_name || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">User ID</dt>
                    <dd className="break-all font-mono text-xs">{detail.id}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Joined</dt>
                    <dd>{formatDate(detail.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last sign-in</dt>
                    <dd>{formatDate(detail.auth.lastSignInAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Email confirmed</dt>
                    <dd>{detail.auth.emailConfirmedAt ? formatDate(detail.auth.emailConfirmedAt) : 'Not confirmed'}</dd>
                  </div>
                  {detail.auth.isBanned ? (
                    <div>
                      <dt className="text-muted-foreground">Auth status</dt>
                      <dd>
                        <Badge variant="destructive">Banned</Badge>
                      </dd>
                    </div>
                  ) : null}
                  {detail.duplicateEmailProfiles.length > 0 ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-amber-900 font-medium">
                        <AlertTriangle className="size-3.5" aria-hidden />
                        Duplicate email detected
                      </dt>
                      <dd className="mt-1 space-y-1 text-xs text-amber-950">
                        {detail.duplicateEmailProfiles.map((duplicate) => (
                          <p key={duplicate.id}>
                            <button
                              type="button"
                              className="font-medium underline"
                              onClick={() => setSelectedId(duplicate.id)}
                            >
                              {duplicate.full_name || duplicate.email || duplicate.id}
                            </button>
                            {' · '}
                            {roleDisplayLabel(duplicate.role as Role)}
                            {duplicate.is_admin ? ' · admin' : ''}
                          </p>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="font-heading text-lg font-semibold text-foreground">Access</h3>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[180px] flex-1 space-y-1">
                    <Label htmlFor="admin-role-select">Role</Label>
                    <Select value={draftRole} onValueChange={(value) => setDraftRole(value as Role)}>
                      <SelectTrigger id="admin-role-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map((role) => (
                          <SelectItem key={role} value={role}>
                            {roleDisplayLabel(role)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending || draftRole === detail.role}
                    onClick={saveRole}
                  >
                    {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    Save role
                  </Button>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Beta tester</p>
                      <p className="text-xs text-muted-foreground">Founding vendor perks</p>
                    </div>
                    <Switch
                      checked={detail.is_beta_tester}
                      disabled={pending}
                      onCheckedChange={(checked) => toggleFlag('set_beta_tester', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Platform wallet blocked</p>
                      <p className="text-xs text-muted-foreground">Blocks coordinator platform fee wallet</p>
                    </div>
                    <Switch
                      checked={detail.platform_wallet_blocked}
                      disabled={pending}
                      onCheckedChange={(checked) => toggleFlag('set_wallet_blocked', checked)}
                    />
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-sm font-medium">Platform admin</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.is_admin
                      ? 'This user has platform admin access (sole-admin policy applies when granting).'
                      : 'Grant full platform admin console access.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant={detail.is_admin ? 'destructive' : 'default'}
                    disabled={pending}
                    onClick={() =>
                      setConfirmAction({ type: 'set_admin', value: !detail.is_admin })
                    }
                  >
                    {detail.is_admin ? 'Revoke admin' : 'Grant admin'}
                  </Button>
                </div>
              </section>

              {detail.role === 'coordinator' ? (
                <section className="space-y-3 lg:col-span-2">
                  <h3 className="font-heading text-lg font-semibold text-foreground">Coordinator</h3>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-muted-foreground">Organization</dt>
                      <dd>{detail.coordinator_organization_name ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Verification</dt>
                      <dd>{detail.coordinator_verification_status ?? 'unverified'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Account status</dt>
                      <dd>{detail.coordinator_account_status ?? 'active'}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Markets owned</dt>
                      <dd>{detail.ownedEventCount}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {(['approve', 'reject', 'suspend', 'reinstate', 'ban'] as const).map((action) => (
                      <Button
                        key={action}
                        type="button"
                        size="sm"
                        variant={action === 'ban' || action === 'reject' ? 'destructive' : 'outline'}
                        disabled={pending}
                        onClick={() => setConfirmAction({ type: 'coordinator', action })}
                      >
                        {action.charAt(0).toUpperCase() + action.slice(1)}
                      </Button>
                    ))}
                  </div>
                </section>
              ) : null}

              <section className="space-y-3">
                <h3 className="font-heading text-lg font-semibold text-foreground">Wallet</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Balance</dt>
                    <dd className="font-medium">{formatCents(detail.walletBalanceCents)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Paddle ID</dt>
                    <dd className="font-mono text-xs">{detail.walletPaddleId ?? '—'}</dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-3">
                <h3 className="font-heading text-lg font-semibold text-foreground">Auth</h3>
                {detail.linkedProviders.length > 0 ? (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <p className="text-sm font-medium">Sign-in methods</p>
                    <ul className="space-y-1 text-sm">
                      {detail.linkedProviders.map((provider) => (
                        <li key={provider.provider} className="flex items-center justify-between gap-2">
                          <span>{provider.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {provider.created_at ? formatDate(provider.created_at) : '—'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No linked sign-in methods found.</p>
                )}
                {detail.duplicateEmailProfiles.length > 0 ? (
                  <div className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="text-sm font-medium text-amber-950">Resolve duplicate account</p>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Remove empty duplicate accounts that share this email. The kept account should
                      connect OAuth from Profile → Account Security.
                    </p>
                    {detail.duplicateEmailProfiles.map((duplicate) => (
                      <Button
                        key={`delete-${duplicate.id}`}
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={pending}
                        onClick={() =>
                          setConfirmAction({
                            type: 'resolve_duplicate',
                            keepUserId: selectedId!,
                            deleteUserId: duplicate.id,
                            keepLabel: detail.full_name || detail.email || 'this account',
                          })
                        }
                      >
                        Delete {duplicate.full_name || duplicate.email || 'duplicate'}, keep this
                        account
                      </Button>
                    ))}
                    {detail.duplicateEmailProfiles.map((duplicate) => (
                      <Button
                        key={`keep-${duplicate.id}`}
                        type="button"
                        size="sm"
                        variant="outline"
                        className="border-amber-400 text-amber-950"
                        disabled={pending || detail.is_admin}
                        onClick={() =>
                          setConfirmAction({
                            type: 'resolve_duplicate',
                            keepUserId: duplicate.id,
                            deleteUserId: selectedId!,
                            keepLabel: duplicate.full_name || duplicate.email || duplicate.id,
                          })
                        }
                      >
                        Delete this account, keep {duplicate.full_name || duplicate.email || 'other'}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending || !detail.email}
                    onClick={() =>
                      startTransition(async () => {
                        await postAction({ action: 'send_password_reset' })
                      })
                    }
                  >
                    Send password reset
                  </Button>
                  {detail.auth.isBanned ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await postAction({ action: 'unban_auth' })
                        })
                      }
                    >
                      Unban auth account
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={pending || detail.is_admin}
                      onClick={() => setConfirmAction({ type: 'ban_auth' })}
                    >
                      Ban auth account
                    </Button>
                  )}
                </div>
              </section>

              <section className="space-y-3 lg:col-span-2">
                <h3 className="font-heading text-lg font-semibold text-foreground">Links</h3>
                <div className="flex flex-wrap gap-2">
                  {detail.role === 'coordinator' ? (
                    <Link href={COORDINATOR_STUDIO_PATH}>
                      <Button type="button" size="sm" variant="outline" className="gap-1.5">
                        HubGrid studio
                        <ExternalLink className="size-3.5" aria-hidden />
                      </Button>
                    </Link>
                  ) : null}
                  {detail.vendorBusinessName ? (
                    <p className="w-full text-xs text-muted-foreground">
                      Vendor passport: {detail.vendorBusinessName}
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-sm text-destructive">Could not load user details.</p>
          )}
        </div>
      ) : null}

      <AlertDialog open={confirmAction !== null} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm action</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'set_role'
                ? `Demote this user from ${roleDisplayLabel(detail?.role ?? 'shopper')} to ${roleDisplayLabel(confirmAction.role)}? They may lose access to portal features immediately.`
                : confirmAction?.type === 'set_admin'
                  ? confirmAction.value
                    ? 'Grant platform admin? This clears admin access from any other user (sole-admin policy).'
                    : 'Revoke platform admin access from this user?'
                  : confirmAction?.type === 'ban_auth'
                    ? 'Ban this auth account? The user will not be able to sign in.'
                    : confirmAction?.type === 'resolve_duplicate'
                      ? `Delete this account and keep ${confirmAction.keepLabel}? The user should sign into the kept account and connect OAuth from Profile settings.`
                      : confirmAction?.type === 'coordinator'
                      ? `Apply coordinator action "${confirmAction.action}" to this account?`
                      : 'Proceed with this action?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={pending} onClick={handleConfirm}>
              {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
