import { MARKET_DAY_FAQ, MARKET_DAY_HOW_TO } from '@/lib/market-day/help-content'
import { BookOpen, CircleHelp, ListChecks } from 'lucide-react'

export function MarketDayGuide() {
  return (
    <div className="space-y-8">
      <section className="market-card overflow-hidden">
        <div className="border-b border-sage-100 bg-sage-50/80 px-5 py-4">
          <div className="flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-sage-700" />
            <h2 className="text-lg font-semibold text-foreground">How to use Market Day Operations</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            End-to-end workflow from layout design through check-in, live tracking, and teardown
            verification.
          </p>
        </div>
        <ol className="divide-y divide-sage-100">
          {MARKET_DAY_HOW_TO.map((section, index) => (
            <li key={section.title} className="px-5 py-5">
              <div className="flex gap-4">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sage-600 text-sm font-bold text-white"
                  aria-hidden
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  <h3 className="font-semibold text-foreground leading-snug">{section.title}</h3>
                  <p className="text-sm text-sage-800/90">{section.summary}</p>
                  <ul className="space-y-1.5 pl-0 list-none">
                    {section.steps.map((step) => (
                      <li
                        key={step}
                        className="flex gap-2 text-sm text-gray-700 leading-relaxed before:content-[''] before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-harvest-500"
                      >
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="market-card overflow-hidden">
        <div className="border-b border-sage-100 bg-amber-50/60 px-5 py-4">
          <div className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-amber-800" />
            <h2 className="text-lg font-semibold text-foreground">Frequently asked questions</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Quick answers about layouts, FCFS, reliability, payments, and cancellations.
          </p>
        </div>
        <div className="divide-y divide-sage-100">
          {MARKET_DAY_FAQ.map((item) => (
            <details key={item.question} className="group px-5 py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 text-sm font-medium text-foreground marker:content-none hover:text-sage-800 [&::-webkit-details-marker]:hidden">
                <span className="pr-2">{item.question}</span>
                <BookOpen className="h-4 w-4 shrink-0 text-sage-500 transition-transform group-open:rotate-12" />
              </summary>
              <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{item.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </div>
  )
}
