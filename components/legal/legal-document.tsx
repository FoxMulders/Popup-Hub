import Link from 'next/link'
import type { ReactNode } from 'react'

interface LegalDocumentProps {
  title: string
  lastUpdated: string
  children: ReactNode
}

export function LegalDocument({ title, lastUpdated, children }: LegalDocumentProps) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
      <p className="mb-6">
        <Link href="/discover" className="text-sm font-medium text-sage-700 hover:underline">
          ← Back to Popup Hub
        </Link>
      </p>

      <article className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-heading prose-headings:tracking-tight prose-a:text-sage-700">
        <header className="not-prose mb-8 border-b border-stone-200 pb-6">
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
        </header>

        {children}

        <footer className="not-prose mt-12 border-t border-stone-200 pt-6 text-sm text-muted-foreground">
          <p>
            Questions about these policies? Contact{' '}
            <a href="mailto:thetipsyfoxyeg@gmail.com" className="font-medium text-sage-700 hover:underline">
              thetipsyfoxyeg@gmail.com
            </a>
            .
          </p>
        </footer>
      </article>
    </main>
  )
}
