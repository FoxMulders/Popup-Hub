'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { CircleHelp, Sparkles } from 'lucide-react'
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
  groupHelpTopicsByCategory,
  searchLayoutEditorHelp,
} from '@/lib/floor-plan/search-layout-editor-help'
import { cn } from '@/lib/utils'

let layoutEditorHelpOpenHandler: (() => void) | null = null
let layoutEditorHelpHostMounted = false

export function openLayoutEditorHelp() {
  layoutEditorHelpOpenHandler?.()
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  const tag = el?.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || el?.isContentEditable === true
}

function HelpTopicDetail({ topic }: { topic: LayoutEditorHelpTopic }) {
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

/** Mount once per layout editor surface (floor plan workspace or spatial layout page). */
export function LayoutEditorHelpHost() {
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

  return <LayoutEditorHelpHostInner />
}

function LayoutEditorHelpHostInner() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string>(
    LAYOUT_EDITOR_HELP_TOPICS[0]?.id ?? 'overview'
  )

  const openHelp = useCallback(() => setOpen(true), [])

  useEffect(() => {
    layoutEditorHelpOpenHandler = openHelp
    return () => {
      if (layoutEditorHelpOpenHandler === openHelp) {
        layoutEditorHelpOpenHandler = null
      }
    }
  }, [openHelp])

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
    [searchResults]
  )

  const selectedTopic =
    LAYOUT_EDITOR_HELP_TOPICS.find((t) => t.id === selectedId) ??
    searchResults[0] ??
    LAYOUT_EDITOR_HELP_TOPICS[0]

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery('')
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={handleOpenChange}
      title="Layout editor help"
      description="Search how to use the floor plan layout editor"
      className="top-[12%] max-w-3xl sm:max-w-3xl"
      showCloseButton
    >
      <Command shouldFilter={false} className="rounded-none border-0 bg-transparent">
        <div className="border-b border-stone-200/80 bg-emerald-50/40 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 shrink-0 text-emerald-700" />
            <p className="text-sm font-semibold text-forest">
              Ask anything about this page
            </p>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Try &quot;place vendors&quot;, &quot;add a door&quot;, &quot;auto
            arrange&quot;, or &quot;save draft&quot;
          </p>
        </div>
        <CommandInput
          placeholder="Search help — e.g. how do I add a door or fix overlaps?"
          value={query}
          onValueChange={setQuery}
        />
        <div className="grid min-h-0 max-h-[min(28rem,calc(100vh-10rem))] grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
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
                    className="flex-col items-start gap-0.5 py-2"
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
            {selectedTopic ? <HelpTopicDetail topic={selectedTopic} /> : null}
          </div>
        </div>
        <div className="border-t border-stone-200/80 px-3 py-2 text-[11px] text-muted-foreground">
          Press{' '}
          <kbd className="rounded border border-stone-300 bg-white px-1 font-semibold">
            ?
          </kbd>{' '}
          anytime to reopen help
        </div>
      </Command>
    </CommandDialog>
  )
}

export interface LayoutEditorHelpButtonProps {
  variant?: 'default' | 'icon' | 'compact'
  className?: string
}

export function LayoutEditorHelpButton({
  variant = 'default',
  className,
}: LayoutEditorHelpButtonProps) {
  if (variant === 'icon') {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon"
        className={cn('h-8 w-8 shrink-0', className)}
        onClick={openLayoutEditorHelp}
        aria-label="Layout editor help"
      >
        <CircleHelp className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn(
        'h-8 shrink-0 gap-1.5',
        variant === 'compact' && 'px-2',
        className
      )}
      onClick={openLayoutEditorHelp}
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
