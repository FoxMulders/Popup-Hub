'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Image from 'next/image'
import { Loader2, PartyPopper, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { selectValueOrNull } from '@/lib/wizard/wizard-autosave'
import {
  FEATURE_IMPACT_LEVELS,
  FEATURE_SUBMITTER_ROLE_OPTIONS,
  FEATURE_TARGET_COMPONENTS,
  defaultSubmitterRoleFromPortal,
  type FeatureImpactLevel,
  type FeatureSubmitterRole,
} from '@/lib/feedback/feature-request-config'
import type { ActivePortal } from '@/lib/portals/active-portal'
import type { Profile } from '@/types/database'
import type { FeatureRequestPrefill } from '@/components/feedback/feature-request-context'

interface FeatureRequestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: Profile
  activePortal: ActivePortal
  pagePath: string
  prefill?: FeatureRequestPrefill | null
}

const EMPTY_FORM = {
  title: '',
  problem: '',
  dreamSolution: '',
  impactLevel: 'nice_to_have' as FeatureImpactLevel,
}

export function FeatureRequestModal({
  open,
  onOpenChange,
  profile,
  activePortal,
  pagePath,
  prefill = null,
}: FeatureRequestModalProps) {
  const [submitterRole, setSubmitterRole] = useState<FeatureSubmitterRole>(
    defaultSubmitterRoleFromPortal(activePortal)
  )
  const [targetComponent, setTargetComponent] = useState(
    FEATURE_TARGET_COMPONENTS[defaultSubmitterRoleFromPortal(activePortal)][0]?.value ?? 'other'
  )
  const [form, setForm] = useState(EMPTY_FORM)
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [pending, startTransition] = useTransition()

  const targetOptions = FEATURE_TARGET_COMPONENTS[submitterRole]

  const canSubmit = useMemo(() => {
    return (
      form.title.trim().length > 0 &&
      form.problem.trim().length > 0 &&
      submitterRole.length > 0 &&
      targetComponent.length > 0
    )
  }, [form.problem, form.title, submitterRole, targetComponent])

  useEffect(() => {
    if (!open) return
    const role = prefill?.submitterRole ?? defaultSubmitterRoleFromPortal(activePortal)
    setSubmitterRole(role)
    const defaultTarget =
      prefill?.targetComponent ??
      FEATURE_TARGET_COMPONENTS[role][0]?.value ??
      'other'
    setTargetComponent(defaultTarget)
    setForm({
      title: prefill?.title ?? '',
      problem: prefill?.problem ?? '',
      dreamSolution: prefill?.dreamSolution ?? '',
      impactLevel: 'nice_to_have',
    })
    setScreenshot(null)
    setPreviewUrl(null)
    setSubmitted(false)
  }, [activePortal, open, prefill])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function resetAndClose() {
    onOpenChange(false)
  }

  function handleRoleChange(nextRole: FeatureSubmitterRole) {
    setSubmitterRole(nextRole)
    const firstTarget = FEATURE_TARGET_COMPONENTS[nextRole][0]?.value ?? 'other'
    setTargetComponent(firstTarget)
  }

  function applyScreenshot(file: File | null) {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (!file) {
      setScreenshot(null)
      setPreviewUrl(null)
      return
    }

    const allowed = file.type === 'image/jpeg' || file.type === 'image/png'
    if (!allowed) {
      toast.error('Upload a PNG or JPG screenshot.')
      return
    }

    setScreenshot(file)
    setPreviewUrl(URL.createObjectURL(file))
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0] ?? null
    applyScreenshot(file)
  }

  function submit() {
    if (!canSubmit) return

    startTransition(async () => {
      try {
        const payload = new FormData()
        payload.set('title', form.title.trim())
        payload.set('submitter_role', submitterRole)
        payload.set('session_role', activePortal)
        payload.set('target_component', targetComponent)
        payload.set('problem', form.problem.trim())
        payload.set('dream_solution', form.dreamSolution.trim())
        payload.set('impact_level', form.impactLevel)
        payload.set('page_path', pagePath)
        if (screenshot) payload.set('screenshot', screenshot)

        const res = await fetch('/api/feedback/submit', {
          method: 'POST',
          body: payload,
        })
        const data = (await res.json()) as { error?: string }
        if (!res.ok) {
          toast.error(data.error ?? 'Could not submit your suggestion')
          return
        }

        setForm(EMPTY_FORM)
        setScreenshot(null)
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setPreviewUrl(null)
        setSubmitted(true)
      } catch {
        toast.error('Network error — please try again')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92dvh,760px)] overflow-y-auto sm:max-w-lg">
        {submitted ? (
          <div className="space-y-5 py-2 text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-sage-100 text-forest">
              <PartyPopper className="size-7" aria-hidden />
            </div>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="font-heading text-xl">🚀 Idea Captured!</DialogTitle>
              <DialogDescription className="max-w-md text-sm leading-relaxed text-muted-foreground">
                Thank you for helping us build a better marketplace community. Our optimization team
                reviews every single community suggestion. If your feature gets added to our upcoming
                development sprint, we&apos;ll blast an announcement to your dashboard notifications!
              </DialogDescription>
            </DialogHeader>
            <Button type="button" className="w-full min-h-11" onClick={resetAndClose}>
              Back to the marketplace
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-heading text-lg">Request or Change a Feature</DialogTitle>
              <DialogDescription>
                Help us optimize Popup Hub for {profile.full_name?.trim() || 'you'} and the whole
                community.
              </DialogDescription>
            </DialogHeader>

            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                submit()
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="feature-title">Feature Title</Label>
                <Input
                  id="feature-title"
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="Short headline for your idea"
                  disabled={pending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feature-submitter-role">I am submitting this as a</Label>
                <Select
                  value={submitterRole}
                  onValueChange={(value) => {
                    const next = selectValueOrNull(value)
                    if (next) handleRoleChange(next as FeatureSubmitterRole)
                  }}
                  disabled={pending}
                >
                  <SelectTrigger id="feature-submitter-role" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEATURE_SUBMITTER_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feature-target">Target Component</Label>
                <Select
                  value={targetComponent}
                  onValueChange={(value) => {
                    if (value) setTargetComponent(value)
                  }}
                  disabled={pending}
                >
                  <SelectTrigger id="feature-target" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {targetOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feature-problem">
                  What is frustrating, clunky, or missing in the current setup?
                </Label>
                <Textarea
                  id="feature-problem"
                  value={form.problem}
                  onChange={(event) => setForm((prev) => ({ ...prev, problem: event.target.value }))}
                  rows={4}
                  disabled={pending}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="feature-dream">
                  How can we make this better for you and everyone else using the site?
                </Label>
                <Textarea
                  id="feature-dream"
                  value={form.dreamSolution}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, dreamSolution: event.target.value }))
                  }
                  rows={4}
                  disabled={pending}
                />
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Impact Level</legend>
                <div className="space-y-2">
                  {FEATURE_IMPACT_LEVELS.map((level) => (
                    <label
                      key={level.value}
                      className={cn(
                        'flex cursor-pointer gap-3 rounded-lg border-2 border-stone-200 p-3 transition-colors',
                        form.impactLevel === level.value
                          ? 'border-forest bg-forest/5'
                          : 'hover:bg-canvas'
                      )}
                    >
                      <input
                        type="radio"
                        name="impact-level"
                        value={level.value}
                        checked={form.impactLevel === level.value}
                        onChange={() =>
                          setForm((prev) => ({ ...prev, impactLevel: level.value }))
                        }
                        disabled={pending}
                        className="mt-1 size-4 shrink-0 accent-forest"
                      />
                      <span>
                        <span className="block text-sm font-medium">{level.label}</span>
                        <span className="block text-xs text-muted-foreground">{level.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-2">
                <Label htmlFor="feature-screenshot">Visual Evidence (optional)</Label>
                <div
                  className={cn(
                    'relative rounded-xl border-2 border-dashed p-4 transition-colors',
                    dragActive ? 'border-forest bg-forest/5' : 'border-stone-200 bg-canvas/40'
                  )}
                  onDragOver={(event) => {
                    event.preventDefault()
                    setDragActive(true)
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={handleDrop}
                >
                  {previewUrl ? (
                    <div className="space-y-3">
                      <div className="relative aspect-video overflow-hidden rounded-lg border border-stone-200 bg-white">
                        <Image
                          src={previewUrl}
                          alt="Screenshot preview"
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => applyScreenshot(null)}
                        disabled={pending}
                      >
                        <X className="mr-1.5 size-3.5" />
                        Remove screenshot
                      </Button>
                    </div>
                  ) : (
                    <label
                      htmlFor="feature-screenshot"
                      className="flex cursor-pointer flex-col items-center gap-2 py-4 text-center"
                    >
                      <Upload className="size-5 text-muted-foreground" aria-hidden />
                      <span className="text-sm font-medium">Drag & drop a PNG or JPG screenshot</span>
                      <span className="text-xs text-muted-foreground">or click to browse</span>
                      <input
                        id="feature-screenshot"
                        type="file"
                        accept="image/png,image/jpeg,.png,.jpg,.jpeg"
                        className="sr-only"
                        disabled={pending}
                        onChange={(event) => applyScreenshot(event.target.files?.[0] ?? null)}
                      />
                    </label>
                  )}
                </div>
              </div>

              <Button type="submit" className="w-full min-h-11" disabled={!canSubmit || pending}>
                {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Submit suggestion
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
