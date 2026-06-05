import { cn } from '@/lib/utils'
import { getPassportSocialLinks } from '@/lib/passport/social-links'
import type { PublicPassportIndex } from '@/lib/passport/public-passport-index'

interface PassportPublicCardProps {
  displayName: string
  avatarUrl?: string | null
  avatarFallback?: string
  passport: PublicPassportIndex | null
  subtitle?: string
  className?: string
  children?: React.ReactNode
}

export function PassportPublicCard({
  displayName,
  avatarUrl,
  avatarFallback,
  passport,
  subtitle,
  className,
  children,
}: PassportPublicCardProps) {
  const links = getPassportSocialLinks(
    passport
      ? {
          website_url: passport.websiteUrl,
          instagram_url: passport.instagramUrl,
          facebook_url: passport.facebookUrl,
        }
      : null
  )
  const initials =
    avatarFallback ??
    displayName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  return (
    <div className={cn('rounded-2xl border bg-white p-6 shadow-sm space-y-4', className)}>
      {children}

      <div className="flex items-start gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border bg-canvas">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-harvest-100 text-lg font-bold text-harvest-700">
              {initials}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <h2 className="text-2xl font-bold text-foreground truncate">{displayName}</h2>
            {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
          {passport?.bio ? (
            <p className="text-sm leading-relaxed text-muted-foreground">{passport.bio}</p>
          ) : null}
          {links.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {links.map((link) => {
                const Icon = link.Icon
                return (
                  <a
                    key={link.field}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    title={link.label}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border text-muted-foreground transition hover:border-harvest-300 hover:bg-harvest-50 hover:text-harvest-700"
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </a>
                )
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
