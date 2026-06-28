'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Bell, Lightbulb, ListChecks, LogOut, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { UserAvatar } from '@/components/profile/user-avatar'
import type { UserAvatarSource } from '@/hooks/use-user-avatar'
import { cn } from '@/lib/utils'

export interface AppMenuLink {
  href: string
  label: string
  title?: string
  badgeCount?: number
}

interface AppMenuProfile {
  userId: string
  profile: UserAvatarSource
}

interface AppMenuSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  links: AppMenuLink[]
  pathname: string
  profileName?: string
  menuProfile?: AppMenuProfile
  unreadCount?: number
  onSignOut?: () => void | Promise<void>
  extraLinks?: AppMenuLink[]
  footer?: ReactNode
  onSuggestImprovement?: () => void
  /** Coordinator: per-market links in slide-out menu. */
  marketLinks?: AppMenuLink[]
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function menuItemClass(active: boolean, destructive = false) {
  return cn(
    'flex min-h-10 w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium leading-tight transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
    destructive
      ? 'text-red-600 hover:bg-red-50 hover:text-red-700'
      : active
        ? 'bg-secondary text-secondary-foreground'
        : 'text-foreground hover:bg-muted/80'
  )
}

function MenuSection({
  title,
  listClassName,
  children,
  className,
}: {
  title?: string
  listClassName?: string
  children: ReactNode
  className?: string
}) {
  const labelId = title ? `app-menu-${title.toLowerCase().replace(/\s+/g, '-')}` : undefined

  return (
    <section aria-labelledby={labelId} className={className}>
      {title ? (
        <h2
          id={labelId}
          className="mb-1 px-2.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </h2>
      ) : null}
      <ul className={cn('grid list-none gap-0.5 p-0', listClassName)} role="list">
        {children}
      </ul>
    </section>
  )
}

function MenuLinkItem({
  href,
  label,
  pathname,
  onNavigate,
  icon,
  trailing,
  destructive,
  title,
  badgeCount,
}: {
  href: string
  label: string
  pathname: string
  onNavigate: () => void
  icon?: ReactNode
  trailing?: ReactNode
  destructive?: boolean
  title?: string
  badgeCount?: number
}) {
  const active = isActivePath(pathname, href)

  return (
    <li>
      <Link
        href={href}
        onClick={onNavigate}
        title={title}
        className={menuItemClass(active, destructive)}
        aria-current={active ? 'page' : undefined}
      >
        {icon}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {trailing}
        {typeof badgeCount === 'number' && badgeCount > 0 ? (
          <Badge className="ml-auto bg-red-500 text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </Badge>
        ) : null}
      </Link>
    </li>
  )
}

function MenuButtonItem({
  label,
  onClick,
  icon,
  trailing,
  destructive,
}: {
  label: string
  onClick: () => void
  icon?: ReactNode
  trailing?: ReactNode
  destructive?: boolean
}) {
  return (
    <li>
      <button type="button" onClick={onClick} className={menuItemClass(false, destructive)}>
        {icon}
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
        {trailing}
      </button>
    </li>
  )
}

export function AppMenuSheet({
  open,
  onOpenChange,
  links,
  pathname,
  profileName,
  menuProfile,
  unreadCount = 0,
  onSignOut,
  extraLinks = [],
  footer,
  onSuggestImprovement,
  marketLinks = [],
}: AppMenuSheetProps) {
  const router = useRouter()

  function closeAndNavigate(href: string) {
    onOpenChange(false)
    router.push(href)
  }

  const close = () => onOpenChange(false)

  const supplementalLinks = extraLinks.filter(
    (link) => !(menuProfile && link.href === '/profile')
  )

  const primaryLinks = links
  const allNavLinks = [
    ...primaryLinks,
    ...supplementalLinks.filter(
      (link) => !primaryLinks.some((primary) => primary.href === link.href)
    ),
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="safe-top safe-x flex h-dvh max-h-dvh w-[min(100vw-1rem,20rem)] min-h-0 flex-col gap-0 overflow-hidden p-0 pt-[max(0.75rem,env(safe-area-inset-top,0px))] data-[side=right]:h-dvh data-[side=right]:max-h-dvh"
      >
        <SheetClose
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top,0px))] z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stone-200 bg-white text-foreground hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close menu"
        >
          <X className="h-4 w-4" aria-hidden />
          <span className="sr-only">Close</span>
        </SheetClose>
        {menuProfile ? (
          <div className="shrink-0 border-b border-stone-200 px-3 py-2.5 pr-11">
            <Link
              href="/profile"
              onClick={close}
              className="flex items-center gap-2.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Profile settings"
            >
              <UserAvatar
                userId={menuProfile.userId}
                profile={menuProfile.profile}
                className="h-9 w-9 shrink-0"
                fallbackClassName="text-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-heading text-sm font-semibold leading-tight">
                  {profileName || 'Your profile'}
                </p>
                <p className="truncate text-xs text-muted-foreground">Profile settings</p>
              </div>
            </Link>
          </div>
        ) : (
          <SheetHeader className="space-y-0 px-3 pb-0 pt-3 pr-11">
            <SheetTitle className="text-left font-heading text-base">Menu</SheetTitle>
            {profileName ? (
              <p className="truncate text-left text-xs text-muted-foreground">{profileName}</p>
            ) : null}
          </SheetHeader>
        )}

        <nav
          className="safe-bottom flex min-h-0 flex-1 flex-col gap-2 overflow-x-hidden overflow-y-auto overscroll-y-contain px-3 pb-3 pt-1 [-webkit-overflow-scrolling:touch]"
          aria-label="App menu"
        >
          {marketLinks.length > 0 ? (
            <MenuSection title="Your markets" listClassName="flex flex-col">
              {marketLinks.map(({ href, label, title, badgeCount }) => (
                <MenuLinkItem
                  key={`market-${href}-${label}`}
                  href={href}
                  label={label}
                  title={title}
                  badgeCount={badgeCount}
                  pathname={pathname}
                  onNavigate={close}
                />
              ))}
            </MenuSection>
          ) : null}

          {allNavLinks.length > 0 ? (
            <MenuSection title={allNavLinks.length > 1 ? 'Navigate' : undefined} listClassName="flex flex-col">
              {allNavLinks.map(({ href, label, title, badgeCount }) => (
                <MenuLinkItem
                  key={`${href}-${label}`}
                  href={href}
                  label={label}
                  title={title}
                  badgeCount={badgeCount}
                  pathname={pathname}
                  onNavigate={close}
                />
              ))}
            </MenuSection>
          ) : null}

          <MenuSection title="Actions">
            {onSuggestImprovement ? (
              <MenuButtonItem
                label="Suggest an Improvement"
                icon={<Lightbulb className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                onClick={() => {
                  close()
                  onSuggestImprovement()
                }}
              />
            ) : null}
            <MenuButtonItem
              label="My Suggestions"
              icon={<ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              onClick={() => closeAndNavigate('/suggestions')}
            />
            <MenuButtonItem
              label="Notifications"
              icon={<Bell className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
              trailing={
                unreadCount > 0 ? (
                  <Badge className="ml-auto bg-red-500 text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Badge>
                ) : null
              }
              onClick={() => closeAndNavigate('/notifications')}
            />
            {onSignOut ? (
              <MenuButtonItem
                label="Sign out"
                icon={<LogOut className="h-4 w-4 shrink-0" aria-hidden />}
                destructive
                onClick={() => {
                  close()
                  void onSignOut()
                }}
              />
            ) : null}
          </MenuSection>

          {footer ? (
            <div className="mt-auto space-y-1.5 border-t border-stone-200 pt-2">{footer}</div>
          ) : null}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
