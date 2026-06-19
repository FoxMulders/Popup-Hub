export type CommunityMentionRow = {
  id: string
  quote: string
  sentiment: string | null
  mention_type: string
  coordinator_person_name: string | null
  source_permalink: string | null
  source_snippet: string | null
  responds_to_mention_id?: string | null
  display_order?: number | null
}

export type MentionThread = {
  key: string
  permalink: string | null
  header: string
  contextLine: string | null
  concerns: CommunityMentionRow[]
  clarifications: CommunityMentionRow[]
}

export type GroupedMentions = {
  threads: MentionThread[]
  standalone: CommunityMentionRow[]
}

const CLARIFICATION_TYPES = new Set(['organizer_clarification', 'organizer_response'])

function threadHeader(permalink: string | null, concerns: CommunityMentionRow[]): string {
  if (concerns.some((c) => c.quote.includes('$580'))) return 'Fee discussion'
  if (concerns.some((c) => (c.sentiment ?? '') === 'negative')) return 'Vendor discussion'
  return 'Vendor group thread'
}

function buildContextLine(
  concerns: CommunityMentionRow[],
  clarifications: CommunityMentionRow[]
): string | null {
  const snippet =
    clarifications.find((c) => c.source_snippet)?.source_snippet ??
    concerns.find((c) => c.source_snippet)?.source_snippet
  return snippet ?? null
}

export function groupCommunityMentions(mentions: CommunityMentionRow[]): GroupedMentions {
  const byId = new Map(mentions.map((m) => [m.id, m]))
  const used = new Set<string>()
  const threads: MentionThread[] = []
  const standalone: CommunityMentionRow[] = []

  for (const mention of mentions) {
    if (used.has(mention.id)) continue

    if (mention.responds_to_mention_id && byId.has(mention.responds_to_mention_id)) {
      continue
    }

    const children = mentions.filter(
      (m) => m.responds_to_mention_id === mention.id || m.id === mention.responds_to_mention_id
    )

    const clarifications = mentions.filter(
      (m) =>
        (m.responds_to_mention_id === mention.id || children.some((c) => c.id === m.id)) &&
        (CLARIFICATION_TYPES.has(m.mention_type) || m.id !== mention.id)
    )

    const permalink = mention.source_permalink
    const samePermalinkClarifications =
      permalink != null
        ? mentions.filter(
            (m) =>
              m.source_permalink === permalink &&
              m.id !== mention.id &&
              (CLARIFICATION_TYPES.has(m.mention_type) ||
                m.mention_type === 'organizer_clarification')
          )
        : clarifications

    if (samePermalinkClarifications.length > 0 && !CLARIFICATION_TYPES.has(mention.mention_type)) {
      const concerns = [mention]
      const clar = samePermalinkClarifications.sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      )
      for (const c of [...concerns, ...clar]) used.add(c.id)

      threads.push({
        key: permalink ?? mention.id,
        permalink,
        header: threadHeader(permalink, concerns),
        contextLine: buildContextLine(concerns, clar),
        concerns,
        clarifications: clar,
      })
      continue
    }

    if (CLARIFICATION_TYPES.has(mention.mention_type) && mention.responds_to_mention_id) {
      continue
    }

    standalone.push(mention)
    used.add(mention.id)
  }

  for (const mention of mentions) {
    if (used.has(mention.id)) continue
    if (
      mention.source_permalink &&
      mentions.some(
        (other) =>
          other.id !== mention.id &&
          other.source_permalink === mention.source_permalink &&
          used.has(other.id)
      )
    ) {
      continue
    }
    standalone.push(mention)
    used.add(mention.id)
  }

  return { threads, standalone }
}
