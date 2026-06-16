'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CircleHelp, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  LAYOUT_EDITOR_HELP_CATEGORY_LABELS,
  LAYOUT_EDITOR_HELP_TOPICS,
  type LayoutEditorHelpTopic,
} from '@/lib/floor-plan/layout-editor-help-content'
import {
  dismissLayoutHelpAutoTour,
  dismissLayoutHelpBanner,
  hasEngagedWithLayoutHelp,
  isLayoutHelpAutoTourDismissed,
  isLayoutHelpBannerDismissed,
  markLayoutHelpEngaged,
} from '@/lib/floor-plan/layout-editor-help-prefs'
import {
  getTourStepsForTopic,
  QUICK_START_TOUR_STEPS,
} from '@/lib/floor-plan/layout-editor-help-tours'
import {
  groupHelpTopicsByCategory,
  searchLayoutEditorHelp,
} from '@/lib/floor-plan/search-layout-editor-help'
import { LayoutEditorHelpTourOverlay } from './layout-editor-help-tour'
import { cn } from '@/lib/utils'

const QUICK_START_TOPIC_ID = 'quick-start'

let layoutEditorHelpOpenHandler: (() => void) | null = null
let layoutEditorHelpTourHandler: ((topicId: string) => void) | null = null
let layoutEditorHelpHostMounted = false

export function openLayoutEditorHelp() {
  layoutEditorHelpOpenHandler?.()
}

export function startLayoutEditorHelpTour(topicId: string) {
  layoutEditorHelpTourHandler?.(topicId)
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}

function HelpTopicDetail({
  topic,
  onStartTour,
}: {
  topic: LayoutEditorHelpTopic
  onStartTour?: (topicId: string) => void
}) {
  const tourAvailable = Boolean(getTourStepsForTopic(topic.id))

  return (
    <div className="flex min-h-0 flex-col gap-3 p-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {LAYOUT_EDITOR_HELP_CATEGORY_LABELS[topic.category]}
        </p>
        <h3 className="mt-1 font-heading text-base font-bold text-forest">
          {topic.title}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {topic.summary}
        </p>
      </div>
      {tourAvailable && onStartTour ? (
        <Button
          type="button"
          size="sm"
          className="h-9 w-full gap-2 bg-forest hover:bg-forest/90 sm:w-auto"
          onClick={() => onStartTour(topic.id)}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Show me on the page
        </Button>
      ) : null}
      <ol className="space-y-2">
        {topic.steps.map((step, index) => (
          <li
            key={step}
            className="flex gap-2 text-sm leading-relaxed text-foreground"
          >
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-900"
              aria-hidden
            >
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

/** Dismissible strip — show until the coordinator dismisses it. */
export function LayoutEditorHelpBanner({ className }: { className?: string }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(!isLayoutHelpBannerDismissed())
  }, [])

  if (!visible) return null

  return (
    <div
      className={cn(
        'flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-white to-emerald-50/60 px-3 py-2.5 sm:px-4',
        className
      )}
      role="region"
      aria-label="Layout editor getting started"
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest text-white shadow-sm"
          aria-hidden
        >
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-forest">
            First time on the layout editor?
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
            There are a lot of tools here — that&apos;s normal. Open{' '}
            <strong className="font-semibold text-foreground">Layout help</strong>{' '}
            for a 6-step quick start and searchable guides for everything on this
            page.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-9 gap-2 bg-forest hover:bg-forest/90"
          onClick={() => startLayoutEditorHelpTour('quick-start')}
        >
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
          Guide me on the page
        </Button>
        <LayoutEditorHelpButton variant="prominent" size="default" />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            dismissLayoutHelpAutoTour()
            dismissLayoutHelpBanner()
            setVisible(false)
          }}
        >
          Don&apos;t show tour again
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 shrink-0 px-2 text-muted-foreground hover:text-foreground"
          onClick={() => {
            dismissLayoutHelpBanner()
            setVisible(false)
          }}
          aria-label="Dismiss layout help tip"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/** Always-visible floating entry point on the canvas. */
export function LayoutEditorHelpFab() {
  const [pulse, setPulse] = useState(false)

  useEffect(() => {
    setPulse(!hasEngagedWithLayoutHelp())
  }, [])

  const handleClick = () => {
    markLayoutHelpEngaged()
    setPulse(false)
    openLayoutEditorHelp()
  }

  return (
    <div
      className="pointer-events-none fixed bottom-5 right-5 z-[120] flex flex-col items-end gap-1 sm:bottom-6 sm:right-6"
      aria-hidden={false}
    >
      {pulse ? (
        <span
          className="rounded-full bg-forest/15 px-2.5 py-1 text-[10px] font-semibold text-forest shadow-sm ring-1 ring-forest/20"
        >
          New? Start here
        </span>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'pointer-events-auto inline-flex items-center gap-2 rounded-full border border-emerald-600 bg-forest px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-forest/90 active:scale-[0.98]',
          pulse && 'animate-pulse ring-4 ring-emerald-300/50'
        )}
        aria-label="Open layout editor help"
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        Layout help
      </button>
    </div>
  )
}

/** Mount once per layout editor surface (floor plan workspace or spatial layout page). */
export function LayoutEditorHelpHost({
  showFloatingFab = true,
}: {
  /** Hide when the toolbar already exposes Layout help (avoids footer overlap). */
  showFloatingFab?: boolean
} = {}) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (layoutEditorHelpHostMounted) return
    layoutEditorHelpHostMounted = true
    setActive(true)
    return () => {
      layoutEditorHelpHostMounted = false
    }
  }, [])

  if (!active) return null

  return <LayoutEditorHelpHostInner showFloatingFab={showFloatingFab} />
}

function LayoutEditorHelpHostInner({
  showFloatingFab,
}: {
  showFloatingFab: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>(QUICK_START_TOPIC_ID)
  const [tourSteps, setTourSteps] = useState<typeof QUICK_START_TOUR_STEPS | null>(
    null
  )
  const [tourStepIndex, setTourStepIndex] = useState(0)

  const startTourForTopic = useCallback((topicId: string) => {
    const steps = getTourStepsForTopic(topicId)
    if (!steps?.length) return
    markLayoutHelpEngaged()
    setOpen(false)
    setQuery('')
    setTourSteps(steps)
    setTourStepIndex(0)
  }, [])

  const closeTour = useCallback(() => {
    setTourSteps(null)
    setTourStepIndex(0)
  }, [])

  const dismissAutoTour = useCallback(() => {
    dismissLayoutHelpAutoTour()
    closeTour()
  }, [closeTour])

  const openHelp = useCallback(() => {
    markLayoutHelpEngaged()
    setSelectedId(QUICK_START_TOPIC_ID)
    setOpen(true)
  }, [])

  useEffect(() => {
    layoutEditorHelpOpenHandler = openHelp
    layoutEditorHelpTourHandler = startTourForTopic
    return () => {
      if (layoutEditorHelpOpenHandler === openHelp) {
        layoutEditorHelpOpenHandler = null
      }
      if (layoutEditorHelpTourHandler === startTourForTopic) {
        layoutEditorHelpTourHandler = null
      }
    }
  }, [openHelp, startTourForTopic])

  useEffect(() => {
    if (hasEngagedWithLayoutHelp() || isLayoutHelpAutoTourDismissed()) return
    const timer = window.setTimeout(() => {
      if (hasEngagedWithLayoutHelp() || isLayoutHelpAutoTourDismissed()) return
      startTourForTopic('quick-start')
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [startTourForTopic])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return
      if (isTypingTarget(e.target)) return
      e.preventDefault()
      openHelp()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openHelp])

  const searchResults = useMemo(
    () => searchLayoutEditorHelp(query, 20).map((r) => r.topic),
    [query]
  )

  const groupedResults = useMemo(
    () => groupHelpTopicsByCategory(searchResults),
    [query]
  )

  const selectedTopic =
    LAYOUT_EDITOR_HELP_TOPICS.find((t) => t.id === selectedId) ??
    searchResults[0] ??
    LAYOUT_EDITOR_HELP_TOPICS[0]

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
    if (next) markLayoutHelpEngaged()
  }

  return (
    <>
      {!tourSteps && showFloatingFab ? <LayoutEditorHelpFab /> : null}
      {tourSteps ? (
        <LayoutEditorHelpTourOverlay
          steps={tourSteps}
          stepIndex={tourStepIndex}
          onStepIndexChange={setTourStepIndex}
          onClose={closeTour}
          onDismissAutoTour={dismissAutoTour}
        />
      ) : null}
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        title="Layout editor help"
        description="Search how to use the floor plan layout editor"
        className="top-[10%] max-w-3xl sm:max-w-4xl"
        showCloseButton
      >
        <Command shouldFilter={false} className="rounded-none border-0 bg-transparent">
          <div className="border-b border-emerald-200/80 bg-gradient-to-br from-emerald-50 to-white px-4 py-3">
            <div className="flex items-start gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest text-white shadow-md"
                aria-hidden
              >
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-heading text-base font-bold text-forest sm:text-lg">
                  Layout help — search or browse
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Feeling overwhelmed?{' '}
                  <button
                    type="button"
                    className="font-semibold text-forest underline decoration-emerald-300 underline-offset-2 hover:text-forest/80"
                    onClick={() => startTourForTopic('quick-start')}
                  >
                    Walk me through on the page
                  </button>
                  {' '}or browse topics below.
                </p>
                <Button
                  type="button"
                  size="sm"
                  className="mt-2 h-8 gap-1.5 bg-forest hover:bg-forest/90"
                  onClick={() => startTourForTopic('quick-start')}
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Start interactive tour
                </Button>
              </div>
            </div>
          </div>
          <CommandInput
            placeholder="What do you want to do? e.g. add booths, fix overlaps, save layout…"
            value={query}
            onValueChange={setQuery}
          />
          <div className="grid min-h-0 max-h-[min(30rem,calc(100vh-11rem))] grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <CommandList className="max-h-none border-b border-stone-200/80 md:border-b-0 md:border-r">
              <CommandEmpty>No matching topics — try a shorter phrase.</CommandEmpty>
              {groupedResults.map((group) => (
                <CommandGroup
                  key={group.category}
                  heading={LAYOUT_EDITOR_HELP_CATEGORY_LABELS[group.category]}
                >
                  {group.topics.map((topic) => (
                    <CommandItem
                      key={topic.id}
                      value={topic.id}
                      onSelect={() => setSelectedId(topic.id)}
                      data-checked={selectedId === topic.id}
                      className={cn(
                        'flex-col items-start gap-0.5 py-2',
                        topic.id === QUICK_START_TOPIC_ID &&
                          'border border-emerald-200/80 bg-emerald-50/50'
                      )}
                    >
                      <span className="font-medium text-foreground">{topic.title}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        {topic.summary}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
            <div className="min-h-0 overflow-y-auto bg-stone-50/50" aria-live="polite">
              {selectedTopic ? (
                <HelpTopicDetail topic={selectedTopic} onStartTour={startTourForTopic} />
              ) : null}
            </div>
          </div>
          <div className="border-t border-stone-200/80 px-3 py-2 text-[11px] text-muted-foreground">
            Green <strong className="font-semibold text-forest">Layout help</strong>{' '}
            in the site header or toolbar · Press{' '}
            <kbd className="rounded border border-stone-300 bg-white px-1 font-semibold">
              ?
            </kbd>{' '}
            anytime
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}

export interface LayoutEditorHelpButtonProps {
  variant?: 'default' | 'icon' | 'compact' | 'prominent'
  size?: 'default' | 'sm'
  className?: string
}

export function LayoutEditorHelpButton({
  variant = 'default',
  size = 'sm',
  className,
}: LayoutEditorHelpButtonProps) {
  const handleClick = () => {
    markLayoutHelpEngaged()
    openLayoutEditorHelp()
  }

  if (variant === 'prominent') {
    return (
      <Button
        type="button"
        size={size}
        data-layout-help="layout-help-btn"
        className={cn(
          'h-9 shrink-0 gap-2 border-0 bg-forest font-semibold text-white shadow-md hover:bg-forest/90',
          size === 'sm' && 'h-8 text-xs',
          className
        )}
        onClick={handleClick}
      >
        <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
        Layout help
      </Button>
    )
  }

  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('h-8 w-8 shrink-0', className)}
        onClick={handleClick}
        aria-label="Layout editor help"
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant={variant === 'compact' ? 'outline' : 'outline'}
      size={size}
      className={cn(
        'h-8 shrink-0 gap-1.5',
        variant === 'compact' && 'px-2',
        className
      )}
      onClick={handleClick}
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      {variant === 'compact' ? (
        <span className="hidden sm:inline">Help</span>
      ) : (
        'Help'
      )}
    </Button>
  )
}
