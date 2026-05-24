import Link from 'next/link'
import { LEGAL_LINKS } from '@/lib/legal/links'

export function ComplianceFooter() {
  return (
    <footer className="border-t border-stone-200 bg-cream/80">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between xl:px-10">
        <p>© {new Date().getFullYear()} Popup Hub. All rights reserved.</p>
        <nav aria-label="Legal and compliance">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="inline-flex min-h-11 items-center font-medium text-foreground/80 hover:text-sage-700 hover:underline touch-manipulation"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
