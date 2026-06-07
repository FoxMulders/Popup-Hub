'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const MONTHLY_RUN_LIMIT = 50
const COOLDOWN_SECONDS = 30

/** Staging profile — mirrors planned `ai_runs_this_month` column. */
export interface UserProfileQa {
  remainingCredits: number
  monthlyLimit: number
}

const DEFAULT_PROFILE_QA: UserProfileQa = {
  remainingCredits: 48,
  monthlyLimit: MONTHLY_RUN_LIMIT,
}

function triggerToastNotification(message: string) {
  toast.error(message, { duration: 5000 })
}

/**
 * QA staging card for AI theme/puzzle generation guardrails — cooldown,
 * credit depletion, and monthly limit HUD before production API wiring.
 */
export function AiGenerationGuardrailsQa({
  userProfile = DEFAULT_PROFILE_QA,
}: {
  userProfile?: UserProfileQa
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [cooldownSeconds, setCooldownSeconds] = useState(0)
  const [remainingCredits, setRemainingCredits] = useState(userProfile.remainingCredits)

  useEffect(() => {
    setRemainingCredits(userProfile.remainingCredits)
  }, [userProfile.remainingCredits])

  useEffect(() => {
    if (cooldownSeconds <= 0) return
    const timer = window.setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          setIsGenerating(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldownSeconds])

  const handleGenerateAITheme = useCallback(async () => {
    if (isGenerating || cooldownSeconds > 0) return

    if (remainingCredits <= 0) {
      triggerToastNotification(
        'You have reached your generative limit for the month. Upgrade your plan to unlock more runs.'
      )
      return
    }

    setIsGenerating(true)
    setCooldownSeconds(COOLDOWN_SECONDS)

    // Staging only — production will call the server handler with rate limits.
    await new Promise((resolve) => window.setTimeout(resolve, 1200))
    setRemainingCredits((prev) => Math.max(0, prev - 1))
    toast.success('AI theme draft staged (QA — no API call).')
  }, [cooldownSeconds, isGenerating, remainingCredits])

  const used = userProfile.monthlyLimit - remainingCredits
  const buttonDisabled = isGenerating || cooldownSeconds > 0 || remainingCredits <= 0

  return (
    <section
      className="mx-2 mb-3 rounded-lg border border-slate-200 bg-slate-50/90 p-3"
      aria-label="AI generation guardrails (QA staging)"
    >
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-emerald-700" aria-hidden />
        <h3 className="text-xs font-bold tracking-wider text-slate-700 uppercase">
          AI Theme Wizard (QA)
        </h3>
      </div>

      <p
        className="mb-3 rounded-md bg-white px-2.5 py-1.5 text-xs tabular-nums text-slate-700"
        data-testid="qa-ai-runs-remaining"
      >
        Generative Runs Remaining:{' '}
        <strong>
          {remainingCredits} / {userProfile.monthlyLimit}
        </strong>
        {used > 0 ? (
          <span className="text-slate-500"> · {used} used this month</span>
        ) : null}
      </p>

      <Button
        type="button"
        size="sm"
        className="w-full gap-2"
        disabled={buttonDisabled}
        onClick={() => void handleGenerateAITheme()}
      >
        {isGenerating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {cooldownSeconds > 0
              ? `AI is constructing your room logic… ${cooldownSeconds}s`
              : 'AI is constructing your room logic… please wait.'}
          </>
        ) : remainingCredits <= 0 ? (
          'Monthly AI limit reached'
        ) : (
          'Generate Theme'
        )}
      </Button>

      {cooldownSeconds > 0 ? (
        <p className="mt-2 text-center text-[10px] text-muted-foreground" role="status">
          Cooldown: {cooldownSeconds}s remaining (30s between runs)
        </p>
      ) : null}
    </section>
  )
}
