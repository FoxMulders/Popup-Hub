import Link from 'next/link'
import type { ReactNode } from 'react'

interface LegalDocumentProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalDocument({ title, lastUpdated, children }: LegalDocumentProps) {
  return (
    <>
      <div className="border-b border-stone-200/50 bg-gradient-to-b from-sage-50/80 to-transparent px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-widest text-sage-700">Legal</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>
      </div>

      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-12">
        <p className="mb-6">
          <Link href="/discover" className="text-sm font-semibold text-forest hover:underline">
            ← Back to Popup Hub
          </Link>
        </p>

        <article className="marketing-glass-card prose prose-slate max-w-none p-6 sm:p-8 dark:prose-invert prose-headings:font-bold prose-headings:tracking-tight prose-a:text-forest">
          {children}

          <footer className="not-prose mt-12 border-t border-stone-200/60 pt-6 text-sm text-muted-foreground">
            <p>
              Questions about these policies? Contact{' '}
              <a
                href="mailto:thetipsyfoxyeg@gmail.com"
                className="font-medium text-forest hover:underline"
              >
                thetipsyfoxyeg@gmail.com
              </a>
              .
            </p>
          </footer>
        </article>
      </main>
    </>
  )
}
