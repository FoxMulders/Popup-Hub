import fs from 'node:fs'
import path from 'node:path'

export type WorkflowState = {
  eventId?: string
  eventName?: string
  applicationId?: string
}

const STATE_PATH = path.join(__dirname, '.workflow-state.json')

export function readWorkflowState(): WorkflowState {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) as WorkflowState
  } catch {
    return {}
  }
}

export function writeWorkflowState(state: WorkflowState): void {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true })
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2))
}

export type WorkflowFixtures = {
  draftEventId: string
  draftEventName: string
  categoryId: string
  categoryName: string
  coordinatorId: string
  vendorId: string
}

const FIXTURES_PATH = path.join(__dirname, '.fixtures.json')

export function readWorkflowFixtures(): WorkflowFixtures {
  const raw = fs.readFileSync(FIXTURES_PATH, 'utf8')
  return JSON.parse(raw) as WorkflowFixtures
}

export function requireWorkflowFixtures(): WorkflowFixtures {
  try {
    return readWorkflowFixtures()
  } catch {
    throw new Error(
      'Missing tests/e2e/workflow/.fixtures.json — run npm run seed:test-users first'
    )
  }
}
