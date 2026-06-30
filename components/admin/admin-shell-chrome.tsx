'use client'

import type { ReactNode } from 'react'
import { PageBackBar } from '@/components/navigation/page-back-bar'
import { SwipeBackHandler } from '@/components/navigation/swipe-back-handler'
import { AdminQueueNav } from '@/components/admin/admin-queue-nav'

interface AdminShellChromeProps {
  children: ReactNode
}

/** Client chrome for the platform admin Operations Console — uniform back bar + swipe history. */
export function AdminShellChrome({ children }: AdminShellChromeProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SwipeBackHandler />
      <header className="safe-top shrink-0 border-b border-border bg-card/90 backdrop-blur-sm">
        <PageBackBar className="border-b border-stone-200/60" />
        <div className="mx-auto max-w-[1600px] space-y-3 px-4 pb-3 pt-2">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              Platform Admin
            </p>
            <h1 className="font-heading text-lg font-semibold text-foreground">Operations Console</h1>
          </div>
          <AdminQueueNav />
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col p-4">{children}</main>
    </div>
  )
}
