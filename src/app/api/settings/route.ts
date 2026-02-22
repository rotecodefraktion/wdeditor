import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { settingsFormSchema } from '@/lib/settings-schema'
import { encrypt, getPatHint } from '@/lib/encryption'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import type { SettingsResponse } from '@/lib/settings-schema'

/** Rate limit: max 10 settings saves per 5 minutes per user */
const SETTINGS_SAVE_RATE_LIMIT = { maxRequests: 10, windowMs: 5 * 60_000 }

/**
 * GET /api/settings
 * Returns global settings. Never returns the full PAT -- only hint (last 4 chars).
 * Requires admin or super_admin role.
 */
export async function GET() {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch settings (single-row table)
  // Note: We deliberately do NOT select github_pat_encrypted here.
  // The has_pat boolean is derived from github_pat_hint being non-null,
  // which avoids loading the encrypted PAT into server memory unnecessarily.
  const { data: settings, error } = await supabase
    .from('app_settings')
    .select(
      'github_repo, github_pat_hint, dev_branch, instance_profile_path, rules_txt_path, updated_at, updated_by'
    )
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found (settings not configured yet)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!settings) {
    // No settings configured yet
    const empty: SettingsResponse = {
      github_repo: '',
      github_pat_hint: null,
      dev_branch: 'dev',
      instance_profile_path: '',
      rules_txt_path: '',
      updated_at: null,
      updated_by: null,
      has_pat: false,
    }
    return NextResponse.json(empty)
  }

  const response: SettingsResponse = {
    github_repo: settings.github_repo ?? '',
    github_pat_hint: settings.github_pat_hint ?? null,
    dev_branch: settings.dev_branch ?? 'dev',
    instance_profile_path: settings.instance_profile_path ?? '',
    rules_txt_path: settings.rules_txt_path ?? '',
    updated_at: settings.updated_at ?? null,
    updated_by: settings.updated_by ?? null,
    has_pat: settings.github_pat_hint !== null && settings.github_pat_hint.length > 0,
  }

  return NextResponse.json(response)
}

/**
 * PUT /api/settings
 * Saves global settings. PAT is encrypted server-side before storage.
 * Requires admin or super_admin role.
 */
export async function PUT(request: Request) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Rate limit per user
  const rateLimitKey = `settings-save:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, SETTINGS_SAVE_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before saving again.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, SETTINGS_SAVE_RATE_LIMIT)

  // Role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Parse and validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const result = settingsFormSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    )
  }

  const { github_repo, github_pat, dev_branch, instance_profile_path, rules_txt_path } =
    result.data

  // Build upsert payload
  const upsertData: Record<string, unknown> = {
    github_repo,
    dev_branch,
    instance_profile_path,
    rules_txt_path,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }

  // Only update PAT if a new one was provided
  if (github_pat && github_pat.length > 0) {
    upsertData.github_pat_encrypted = encrypt(github_pat)
    upsertData.github_pat_hint = getPatHint(github_pat)
  }

  // Check if settings already exist (and whether a PAT is already stored)
  const { data: existing } = await supabase
    .from('app_settings')
    .select('id, github_pat_hint')
    .limit(1)
    .single()

  // Enforce PAT requirement: if no PAT exists in DB and none was provided, reject.
  // This prevents saving settings without any PAT configured.
  const existingHasPat = existing?.github_pat_hint !== null && existing?.github_pat_hint !== undefined && existing.github_pat_hint.length > 0
  const newPatProvided = !!github_pat && github_pat.length > 0
  if (!existingHasPat && !newPatProvided) {
    return NextResponse.json(
      { error: 'A GitHub Personal Access Token is required. Please provide a PAT.' },
      { status: 400 }
    )
  }

  let dbError
  if (existing) {
    // Update existing row
    const { error } = await supabase
      .from('app_settings')
      .update(upsertData)
      .eq('id', existing.id)
    dbError = error
  } else {
    // Insert new row with a fixed UUID
    const { error } = await supabase.from('app_settings').insert({
      id: '00000000-0000-0000-0000-000000000001',
      ...upsertData,
    })
    dbError = error
  }

  if (dbError) {
    console.error('[PUT /api/settings] DB error:', dbError)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
