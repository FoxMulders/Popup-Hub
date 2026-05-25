import type { SupabaseClient } from '@supabase/supabase-js'
import type { PassportStory, PassportStoryKind } from '@/types/database'
import { PASSPORT_STORY_MAX_COUNT } from '@/lib/passport-stories/media'

export interface PassportStoryView {
  id: string
  ownerId: string
  mediaUrl: string
  mediaType: 'video' | 'image'
  durationSeconds: number | null
  storyKind: PassportStoryKind
  caption: string | null
  createdAt: string
  createdBy: string
}

function mapStory(row: PassportStory): PassportStoryView {
  return {
    id: row.id,
    ownerId: row.owner_id,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    durationSeconds: row.duration_seconds,
    storyKind: row.story_kind,
    caption: row.caption,
    createdAt: row.created_at,
    createdBy: row.created_by,
  }
}

export async function listPassportStories(
  supabase: SupabaseClient,
  ownerId: string
): Promise<PassportStoryView[]> {
  const { data } = await supabase
    .from('passport_stories')
    .select('*')
    .eq('owner_id', ownerId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(PASSPORT_STORY_MAX_COUNT)

  return (data as PassportStory[] | null)?.map(mapStory) ?? []
}

export async function createPassportStory(
  supabase: SupabaseClient,
  input: {
    ownerId: string
    createdBy: string
    mediaUrl: string
    mediaType: 'video' | 'image'
    durationSeconds?: number | null
    storyKind: PassportStoryKind
    caption?: string | null
  }
): Promise<{ ok: true; story: PassportStoryView } | { ok: false; error: string; status: number }> {
  const { count } = await supabase
    .from('passport_stories')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', input.ownerId)

  if ((count ?? 0) >= PASSPORT_STORY_MAX_COUNT) {
    return {
      ok: false,
      error: `You can publish up to ${PASSPORT_STORY_MAX_COUNT} stories. Remove one to add another.`,
      status: 422,
    }
  }

  const { data, error } = await supabase
    .from('passport_stories')
    .insert({
      owner_id: input.ownerId,
      created_by: input.createdBy,
      media_url: input.mediaUrl,
      media_type: input.mediaType,
      duration_seconds: input.durationSeconds ?? null,
      story_kind: input.storyKind,
      caption: input.caption?.trim() || null,
      sort_order: count ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Could not save story', status: 422 }
  }

  return { ok: true, story: mapStory(data as PassportStory) }
}

export async function deletePassportStory(
  supabase: SupabaseClient,
  storyId: string,
  userId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: story } = await supabase
    .from('passport_stories')
    .select('owner_id')
    .eq('id', storyId)
    .maybeSingle()

  if (!story) {
    return { ok: false, error: 'Story not found', status: 404 }
  }

  if (story.owner_id !== userId) {
    return { ok: false, error: 'Forbidden', status: 403 }
  }

  const { error } = await supabase.from('passport_stories').delete().eq('id', storyId)
  if (error) {
    return { ok: false, error: error.message, status: 422 }
  }

  return { ok: true }
}

export function defaultStoryKindForRole(role: string): PassportStoryKind {
  if (role === 'coordinator') return 'market_promo'
  if (role === 'vendor') return 'behind_the_brand'
  return 'story'
}

export function storyKindLabel(kind: PassportStoryKind): string {
  switch (kind) {
    case 'behind_the_brand':
      return 'Behind the Brand'
    case 'market_promo':
      return 'Market Promo'
    default:
      return 'Story'
  }
}
