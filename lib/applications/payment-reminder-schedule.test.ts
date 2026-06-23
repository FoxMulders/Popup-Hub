import { describe, expect, it } from 'vitest'
import { resolveNextReminderStage } from './payment-reminder-schedule'

const HOUR_MS = 60 * 60 * 1000

describe('resolveNextReminderStage', () => {
  it('sends stage 1 when no reminders sent and more than 6h remain', () => {
    expect(resolveNextReminderStage(50 * HOUR_MS, 0)).toEqual({ stage: 1, kind: 'reminder' })
  })

  it('sends stage 2 within 24h but more than 6h remain', () => {
    expect(resolveNextReminderStage(12 * HOUR_MS, 1)).toEqual({ stage: 2, kind: 'reminder' })
  })

  it('sends stage 3 final warning within 6h', () => {
    expect(resolveNextReminderStage(3 * HOUR_MS, 2)).toEqual({ stage: 3, kind: 'reminder' })
  })

  it('returns null when past due', () => {
    expect(resolveNextReminderStage(0, 0)).toBeNull()
  })

  it('skips stage 2 when already at stage 2', () => {
    expect(resolveNextReminderStage(12 * HOUR_MS, 2)).toBeNull()
  })
})
