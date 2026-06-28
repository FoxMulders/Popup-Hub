import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { authenticateWidgetRequest } from '@/lib/widget/auth'
import { buildWidgetFeed } from '@/lib/widget/fetch-data'
import {
  buildCoordinatorFeedSummary,
  buildPatronFeedSummary,
  buildVendorFeedSummary,
} from '@/lib/widget/feed'
import type { WidgetPatronFeed } from '@/lib/widget/types'

export async function GET(request: Request) {
  const service = await createServiceClient()
  const auth = await authenticateWidgetRequest(request, service)

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const { context } = auth
  let marketFilter: WidgetPatronFeed['marketFilter'] | undefined

  if (context.persona === 'patron') {
    const { data: prefs } = await service
      .from('widget_preferences')
      .select('market_filter')
      .eq('user_id', context.userId)
      .maybeSingle()
    if (prefs?.market_filter === 'farmers' || prefs?.market_filter === 'artisan') {
      marketFilter = prefs.market_filter
    }
  }

  const feed = await buildWidgetFeed(service, context.userId, context.persona, { marketFilter })

  const summary =
    feed.persona === 'patron'
      ? buildPatronFeedSummary(feed)
      : feed.persona === 'vendor'
        ? buildVendorFeedSummary(feed)
        : buildCoordinatorFeedSummary(feed)

  return NextResponse.json({
    ...feed,
    summary,
    role: context.role,
    activePortal: context.activePortal,
  })
}
