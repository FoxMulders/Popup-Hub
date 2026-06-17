import {
  LAYOUT_EDITOR_HELP_TOPICS,
  type LayoutEditorHelpCategory,
  type LayoutEditorHelpTopic,
} from './layout-editor-help-content'

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['']/g, '')
}

function tokenize(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1)
}

function scoreTopic(query: string, topic: LayoutEditorHelpTopic): number {
  const q = normalize(query.trim())
  if (!q) return 1

  const title = normalize(topic.title)
  const summary = normalize(topic.summary)
  const keywords = normalize(topic.keywords.join(' '))
  const steps = normalize(topic.steps.join(' '))
  const blob = `${title} ${summary} ${keywords} ${steps}`

  if (title === q) return 200
  if (title.includes(q)) return 120
  if (keywords.includes(q)) return 90
  if (summary.includes(q)) return 70
  if (blob.includes(q)) return 50

  const queryTokens = tokenize(q)
  if (queryTokens.length === 0) return 0

  let score = 0
  for (const token of queryTokens) {
    if (title.includes(token)) score += 24
    if (keywords.includes(token)) score += 16
    if (summary.includes(token)) score += 10
    if (steps.includes(token)) score += 6

    // Prefix match on words in the blob
    const words = tokenize(blob)
    for (const word of words) {
      if (word.startsWith(token)) score += 4
    }
  }

  return score
}

export interface LayoutEditorHelpSearchResult {
  topic: LayoutEditorHelpTopic
  score: number
}

export function searchLayoutEditorHelp(
  query: string,
  limit = 12
): LayoutEditorHelpSearchResult[] {
  const trimmed = query.trim()
  const scored = LAYOUT_EDITOR_HELP_TOPICS
    .map((topic) => ({ topic, score: scoreTopic(trimmed, topic) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)

  if (trimmed && scored.length === 0) {
    return LAYOUT_EDITOR_HELP_TOPICS.slice(0, limit).map((topic) => ({
      topic,
      score: 0,
    }))
  }

  return scored.slice(0, limit)
}

export function groupHelpTopicsByCategory(
  topics: LayoutEditorHelpTopic[]
): Array<{ category: LayoutEditorHelpCategory; topics: LayoutEditorHelpTopic[] }> {
  const order: LayoutEditorHelpCategory[] = [
    'basics',
    'rooms',
    'tools',
    'vendors',
    'ledger',
    'patrons',
    'optimize',
    'view',
    'save',
  ]
  const byCategory = new Map<LayoutEditorHelpCategory, LayoutEditorHelpTopic[]>()
  for (const topic of topics) {
    const list = byCategory.get(topic.category) ?? []
    list.push(topic)
    byCategory.set(topic.category, list)
  }
  return order
    .filter((c) => byCategory.has(c))
    .map((category) => ({
      category,
      topics: byCategory.get(category)!,
    }))
}
