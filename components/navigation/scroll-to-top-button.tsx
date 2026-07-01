'use client'

import { ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useScrollToTopButton } from '@/hooks/use-scroll-to-top-button'
import { useReducedMotion } from '@/hooks/use-reduced-motion'
import { smoothScrollAllHostsToTop } from '@/lib/navigation/scroll-to-top'
import { cn } from '@/lib/utils'

export function ScrollToTopButton() {
  const visible = useScrollToTopButton()
  const reducedMotion = useReducedMotion()

  return (
    <div
      className="scroll-to-top-button-host pointer-events-none fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] right-4 z-40 md:right-6"
      data-scroll-to-top-host
    >
      <Button
        type="button"
        size="icon-lg"
        variant="default"
        aria-label="Back to top"
        aria-hidden={!visible}
        tabIndex={visible ? 0 : -1}
        onClick={() => smoothScrollAllHostsToTop()}
        className={cn(
          'pointer-events-auto rounded-full shadow-[var(--shadow-market-md)] transition-[opacity,transform] duration-200',
          reducedMotion ? '' : 'motion-safe:hover:-translate-y-0.5',
          visible
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0'
        )}
      >
        <ArrowUp aria-hidden />
      </Button>
    </div>
  )
}
