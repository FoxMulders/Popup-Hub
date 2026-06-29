import type { SignupRole } from '@/lib/auth/rbac'

const SIGNUP_ROLE_LABELS: Record<SignupRole, string> = {
  shopper: 'Patron',
  vendor: 'Vendor',
  coordinator: 'Coordinator',
}

export function getSignupRoleLabel(role: SignupRole): string {
  return SIGNUP_ROLE_LABELS[role]
}

export type GoalAnswer = 'attend' | 'sell' | 'organize'
export type YesNo = 'yes' | 'no'

export type QuestionnaireAnswers = {
  goal?: GoalAnswer
  /** When goal is sell — will they also run their own markets? */
  alsoOrganize?: YesNo
  /** When goal is organize — will they also sell as a vendor? */
  alsoSell?: YesNo
}

export type SignupRoleRecommendation = {
  role: SignupRole
  reason: string
  includes: string | null
}

export const QUESTIONNAIRE_GOAL_OPTIONS: readonly {
  id: GoalAnswer
  label: string
  description: string
}[] = [
  {
    id: 'attend',
    label: 'Attend and browse markets',
    description: 'Find events, save favorites, and shop as a patron',
  },
  {
    id: 'sell',
    label: 'Sell at markets as a vendor',
    description: 'Apply for booths and manage a vendor passport',
  },
  {
    id: 'organize',
    label: 'Run or organize markets',
    description: 'Create events, review vendors, and manage market day',
  },
] as const

export function nextQuestionnaireStep(answers: QuestionnaireAnswers): 'goal' | 'also_organize' | 'also_sell' | 'result' {
  if (!answers.goal) return 'goal'
  if (answers.goal === 'attend') return 'result'
  if (answers.goal === 'sell') {
    if (!answers.alsoOrganize) return 'also_organize'
    return 'result'
  }
  if (!answers.alsoSell) return 'also_sell'
  return 'result'
}

export function recommendSignupRole(answers: QuestionnaireAnswers): SignupRoleRecommendation | null {
  if (!answers.goal) return null

  if (answers.goal === 'attend') {
    return {
      role: 'shopper',
      reason:
        'You mainly want to discover markets, save favorites, and shop — a Patron account is the right fit.',
      includes: null,
    }
  }

  if (answers.goal === 'sell') {
    if (!answers.alsoOrganize) return null
    if (answers.alsoOrganize === 'yes') {
      return {
        role: 'coordinator',
        reason:
          'You want to sell at markets and run your own events — choose Coordinator so you get organizer tools plus vendor and patron access.',
        includes: 'Includes Vendor and Patron access',
      }
    }
    return {
      role: 'vendor',
      reason:
        'You want to apply for booths and manage a vendor passport — a Vendor account includes everything you need, plus Patron browsing.',
      includes: 'Includes Patron access',
    }
  }

  if (!answers.alsoSell) return null

  if (answers.alsoSell === 'yes') {
    return {
      role: 'coordinator',
      reason:
        'You will organize markets and also sell as a vendor — Coordinator is the highest role and includes vendor and patron tools.',
      includes: 'Includes Vendor and Patron access',
    }
  }

  return {
    role: 'coordinator',
    reason:
      'You will create and run markets — a Coordinator account gives you organizer tools plus vendor and patron access if you need them later.',
    includes: 'Includes Vendor and Patron access',
  }
}

export function signupRoleSubmitHint(role: SignupRole): string | null {
  if (role === 'vendor') {
    return 'You\u2019ll get vendor tools plus patron browsing.'
  }
  if (role === 'coordinator') {
    return 'You\u2019ll get coordinator, vendor, and patron access.'
  }
  return null
}
