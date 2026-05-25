import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DashboardStatCardProps {
  title: string
  value: React.ReactNode
  icon: LucideIcon
  iconClassName?: string
  href?: string | null
  subtitle?: string | null
  hoverClassName?: string
}

export function DashboardStatCard({
  title,
  value,
  icon: Icon,
  iconClassName,
  href,
  subtitle,
  hoverClassName = 'group-hover:border-forest/30 group-hover:bg-sage-50/40',
}: DashboardStatCardProps) {
  const card = (
    <Card
      className={cn('h-full', href && cn('transition-colors', hoverClassName))}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', iconClassName)} />
          <span className="text-2xl font-bold">{value}</span>
        </div>
        {subtitle ? <p className="text-xs font-medium text-muted-foreground">{subtitle}</p> : null}
      </CardContent>
    </Card>
  )

  if (!href) return card

  return (
    <Link
      href={href}
      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40"
    >
      {card}
    </Link>
  )
}
