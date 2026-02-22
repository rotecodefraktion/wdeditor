import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/settings/status
 * Lightweight endpoint to check if settings are configured.
 * Available to all authenticated users (non-admin users need to know
 * if the app is configured so they can show the UnconfiguredBanner).
 * Does NOT return any sensitive data -- only a boolean.
 *
 * Uses the admin client to bypass RLS (since non-admin users cannot
 * read app_settings via RLS). This is safe because we only return
 * a boolean and never expose any settings values.
 */
export async function GET() {
  const supabase = await createClient()

  // Auth check -- user must be logged in
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Use admin client to check settings existence (bypasses RLS)
  // This is safe: we only return a boolean, no sensitive data
  const adminClient = createAdminClient()
  const { data: settings } = await adminClient
    .from('app_settings')
    .select('github_repo, github_pat_encrypted')
    .limit(1)
    .single()

  const configured = !!(settings?.github_repo && settings?.github_pat_encrypted)

  return NextResponse.json({ configured })
}
