'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

interface MobileNavLink {
  href: string
  label: string
}

interface MobileNavSheetProps {
  links: MobileNavLink[]
  pathname: string
  side?: 'left' | 'right'
  className?: string
  footer?: React.ReactNode
}

export function MobileNavSheet({
  links,
  pathname,
  side = 'right',
  className,
  footer,
}: MobileNavSheetProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={cn(
          'flex min-h-11 min-w-11 items-center justify-center rounded-lg hover:bg-canvas touch-manipulation',
          className
        )}
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Menu className="h-5 w-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={side} className="w-72 max-w-[85vw]">
          <nav className="mt-8 flex flex-col gap-1" aria-label="Mobile navigation">
            {links.map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)}>
                <Button
                  variant={pathname.startsWith(href) ? 'secondary' : 'ghost'}
                  className="w-full justify-start min-h-11"
                  size="sm"
                >
                  {label}
                </Button>
              </Link>
            ))}
            {footer ? <div className="mt-4 space-y-2">{footer}</div> : null}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
