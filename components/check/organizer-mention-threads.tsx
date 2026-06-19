'use client'

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CommunityMention } from '@/types/organizers'
import { groupCommunityMentions, type CommunityMentionRow } from '@/lib/organizers/group-mention-threads'

type Props = {
  mentions: CommunityMention[]
}

function MentionQuote({ mention, label }: { mention: CommunityMentionRow | CommunityMention; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="italic">&ldquo;{mention.quote}&rdquo;</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="text-[10px]">
          {mention.mention_type === 'organizer_clarification'
            ? 'Organizer clarification'
            : 'Community mention (unverified)'}
        </Badge>
        {mention.sentiment ? (
          <Badge variant="outline" className="text-[10px] capitalize">
            {mention.sentiment}
          </Badge>
        ) : null}
      </div>
      {'response_body' in mention && mention.response_body ? (
        <div className="rounded-md border bg-white px-3 py-2 text-xs">
          <p className="font-medium text-foreground">Organizer response</p>
          <p className="mt-1 text-muted-foreground">{(mention as CommunityMention).response_body}</p>
        </div>
      ) : null}
    </div>
  )
}

export function OrganizerMentionThreads({ mentions }: Props) {
  if (mentions.length === 0) {
    return <p className="text-sm text-muted-foreground">No verified community mentions yet.</p>
  }

  const { threads, standalone } = groupCommunityMentions(mentions)

  return (
    <div className="space-y-3">
      {threads.map((thread) => (
        <article key={thread.key} className="rounded-lg border bg-canvas px-3 py-3 text-sm space-y-3">
          <div>
            <p className="font-medium text-foreground">{thread.header}</p>
            <p className="text-xs text-muted-foreground">Vendor group thread</p>
          </div>
          {thread.concerns.map((concern) => (
            <MentionQuote key={concern.id} mention={concern} label="Vendor concern" />
          ))}
          {thread.clarifications.map((clarification) => (
            <div key={clarification.id} className="border-l-2 border-harvest-300 pl-3">
              <MentionQuote mention={clarification} label="Organizer clarification (same thread)" />
            </div>
          ))}
          {thread.contextLine ? (
            <p className="text-xs text-muted-foreground border-t pt-2">{thread.contextLine}</p>
          ) : null}
          {thread.permalink ? (
            <a
              href={thread.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              View source thread
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </article>
      ))}

      {standalone.map((mention) => (
        <article key={mention.id} className="rounded-lg border bg-canvas px-3 py-2 text-sm">
          <MentionQuote mention={mention} label="Community mention" />
          {mention.source_permalink ? (
            <a
              href={mention.source_permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
            >
              View source thread
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : null}
        </article>
      ))}
    </div>
  )
}
