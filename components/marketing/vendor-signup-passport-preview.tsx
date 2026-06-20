import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { VENDOR_OPEN_MARKETS_HREF, VENDOR_PASSPORT_SIGNUP_PREVIEW } from '@/lib/marketing/vendor-journey'

export function VendorSignupPassportPreview() {
  return (
    <div className="mb-4 rounded-xl border border-harvest-200/80 bg-harvest-50/60 px-4 py-3 text-left">
      <p className="text-sm font-semibold text-foreground">{VENDOR_PASSPORT_SIGNUP_PREVIEW.title}</p>
      <ol className="mt-3 space-y-2">
        {VENDOR_PASSPORT_SIGNUP_PREVIEW.steps.map((step, index) => (
          <li key={step.title} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-harvest-100 text-[10px] font-bold text-harvest-800">
              {index + 1}
            </span>
            <span>
              <span className="font-medium text-foreground">{step.title}.</span> {step.detail}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Required to apply:{' '}
        {VENDOR_PASSPORT_SIGNUP_PREVIEW.required.join(' · ')}. Markets may also ask for{' '}
        {VENDOR_PASSPORT_SIGNUP_PREVIEW.oftenRequested.join(', ').toLowerCase()}.
      </p>
      <Link
        href={VENDOR_OPEN_MARKETS_HREF}
        className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-forest hover:underline"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        See open markets without signing up →
      </Link>
    </div>
  )
}
