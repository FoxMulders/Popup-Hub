import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  isValidImpactLevel,
  isValidSubmitterRole,
  isValidTargetComponent,
} from '@/lib/feedback/feature-request-config'
import { uploadFeatureScreenshot } from '@/lib/feedback/upload-feature-screenshot'

/**
 * POST /api/feedback/submit
 * Accepts multipart form data for site-wide feature requests.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Sign in to submit a suggestion' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form submission' }, { status: 400 })
  }

  const title = String(formData.get('title') ?? '').trim()
  const submitterRole = String(formData.get('submitter_role') ?? '').trim()
  const sessionRole = String(formData.get('session_role') ?? '').trim()
  const targetComponent = String(formData.get('target_component') ?? '').trim()
  const problem = String(formData.get('problem') ?? '').trim()
  const dreamSolution = String(formData.get('dream_solution') ?? '').trim()
  const impactLevel = String(formData.get('impact_level') ?? '').trim()
  const pagePath = String(formData.get('page_path') ?? '').trim()
  const screenshot = formData.get('screenshot')

  if (!title || !problem) {
    return NextResponse.json({ error: 'Title and problem are required' }, { status: 400 })
  }

  if (!isValidSubmitterRole(submitterRole)) {
    return NextResponse.json({ error: 'Invalid submitter role' }, { status: 400 })
  }

  if (!isValidSubmitterRole(sessionRole)) {
    return NextResponse.json({ error: 'Invalid session role' }, { status: 400 })
  }

  if (!isValidTargetComponent(submitterRole, targetComponent)) {
    return NextResponse.json({ error: 'Invalid target component for role' }, { status: 400 })
  }

  if (!isValidImpactLevel(impactLevel)) {
    return NextResponse.json({ error: 'Invalid impact level' }, { status: 400 })
  }

  let screenshotUrl: string | null = null
  if (screenshot instanceof File && screenshot.size > 0) {
    try {
      screenshotUrl = await uploadFeatureScreenshot(supabase, user.id, screenshot)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Screenshot upload failed'
      return NextResponse.json({ error: message }, { status: 400 })
    }
  }

  const { data: row, error } = await supabase
    .from('feature_requests')
    .insert({
      user_id: user.id,
      session_role: sessionRole,
      submitter_role: submitterRole,
      title,
      target_component: targetComponent,
      problem,
      dream_solution: dreamSolution || null,
      impact_level: impactLevel,
      screenshot_url: screenshotUrl,
      page_path: pagePath || null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: row.id })
}
