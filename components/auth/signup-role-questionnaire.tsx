'use client'

import { useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type SignupRole } from '@/lib/auth/rbac'
import {
  QUESTIONNAIRE_GOAL_OPTIONS,
  nextQuestionnaireStep,
  recommendSignupRole,
  type QuestionnaireAnswers,
  type YesNo,
} from '@/lib/auth/signup-role-questionnaire'
import { getSignupRoleLabel } from '@/lib/auth/signup-role-questionnaire'

interface SignupRoleQuestionnaireProps {
  onSelectRole: (role: SignupRole) => void
  /** When false (role-locked signup), show recommendation only — no apply button. */
  allowApply?: boolean
}

const YES_NO_OPTIONS: readonly { id: YesNo; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'no', label: 'No' },
] as const

function resetAnswers(): QuestionnaireAnswers {
  return {}
}

export function SignupRoleQuestionnaire({
  onSelectRole,
  allowApply = true,
}: SignupRoleQuestionnaireProps) {
  const [open, setOpen] = useState(false)
  const [answers, setAnswers] = useState<QuestionnaireAnswers>(resetAnswers)

  const step = nextQuestionnaireStep(answers)
  const recommendation = step === 'result' ? recommendSignupRole(answers) : null

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setAnswers(resetAnswers())
    }
  }

  function applyRecommendation() {
    if (!recommendation) return
    onSelectRole(recommendation.role)
    handleOpenChange(false)
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-forest hover:underline"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        Not sure? Help me choose
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Help me choose an account type</DialogTitle>
            <DialogDescription>
              Answer a few quick questions — we&apos;ll suggest the role that fits your primary job on
              Popup Hub.
            </DialogDescription>
          </DialogHeader>

          {step === 'goal' ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">What is your main goal?</p>
              {QUESTIONNAIRE_GOAL_OPTIONS.map(({ id, label, description }) => (
                <button
                  key={id}
                  type="button"
                  className="flex w-full flex-col rounded-xl border border-stone-200/80 px-3 py-3 text-left transition hover:border-harvest-400/60 hover:bg-canvas/50"
                  onClick={() => setAnswers({ goal: id })}
                >
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="mt-0.5 text-xs text-muted-foreground">{description}</span>
                </button>
              ))}
            </div>
          ) : null}

          {step === 'also_organize' ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Will you also organize your own markets?</p>
              {YES_NO_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className="w-full rounded-xl border border-stone-200/80 px-3 py-3 text-left text-sm font-medium transition hover:border-harvest-400/60 hover:bg-canvas/50"
                  onClick={() => setAnswers((prev) => ({ ...prev, alsoOrganize: id }))}
                >
                  {label}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => setAnswers((prev) => ({ goal: prev.goal }))}
              >
                Back
              </Button>
            </div>
          ) : null}

          {step === 'also_sell' ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Will you also sell at markets as a vendor?</p>
              {YES_NO_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className="w-full rounded-xl border border-stone-200/80 px-3 py-3 text-left text-sm font-medium transition hover:border-harvest-400/60 hover:bg-canvas/50"
                  onClick={() => setAnswers((prev) => ({ ...prev, alsoSell: id }))}
                >
                  {label}
                </button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => setAnswers((prev) => ({ goal: prev.goal }))}
              >
                Back
              </Button>
            </div>
          ) : null}

          {step === 'result' && recommendation ? (
            <div className="space-y-3 rounded-xl border border-harvest-200/80 bg-harvest-50/50 px-4 py-4">
              <p className="text-sm font-semibold text-foreground">
                Recommended: {getSignupRoleLabel(recommendation.role)}
              </p>
              <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              {recommendation.includes ? (
                <p className="text-xs font-medium text-harvest-700">{recommendation.includes}</p>
              ) : null}
              {!allowApply ? (
                <p className="text-xs text-muted-foreground">
                  Your signup link is locked to a specific role. Contact support if you need a
                  different account type.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {step === 'result' && recommendation && allowApply ? (
              <>
                <Button type="button" className="w-full min-h-11" onClick={applyRecommendation}>
                  Use {getSignupRoleLabel(recommendation.role)}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full min-h-11"
                  onClick={() => handleOpenChange(false)}
                >
                  Pick a different role
                </Button>
              </>
            ) : step === 'result' ? (
              <Button type="button" variant="outline" className="w-full min-h-11" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
