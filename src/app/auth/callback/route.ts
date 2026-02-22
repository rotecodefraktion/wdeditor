import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Validates the `next` redirect parameter to prevent open redirect attacks.
 * Only allows relative paths starting with / that don't contain protocol-based bypasses.
 */
function sanitizeRedirectPath(next: string | null): string {
  const fallback = '/dashboard'

  if (!next) return fallback

  // Must start with a single slash (reject protocol-relative URLs like //evil.com)
  if (!next.startsWith('/') || next.startsWith('//')) return fallback

  // Reject any URL that contains a protocol scheme (e.g., /foo:bar or javascript:)
  if (/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)) return fallback

  // Reject backslash-based bypasses (e.g., /\evil.com)
  if (next.includes('\\')) return fallback

  return next
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeRedirectPath(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_error`)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`)
  }

  // Profil laden und Status prüfen
  // Use admin client because session cookies are not yet available in the current request
  // after exchangeCodeForSession (same issue as login route)
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('user_profiles')
    .select('status, github_username')
    .eq('user_id', user.id)
    .maybeSingle()

  // Kein Profil: GitHub-OAuth-User ohne App-Account → Register
  if (!profile) {
    const githubUsername =
      user.user_metadata?.user_name ?? user.user_metadata?.login ?? ''
    return NextResponse.redirect(
      `${origin}/register?github=${encodeURIComponent(githubUsername)}`
    )
  }

  // Status-basierte Redirects
  if (profile.status === 'unconfirmed') {
    return NextResponse.redirect(`${origin}/register/confirm-email`)
  }

  if (profile.status === 'pending_approval') {
    return NextResponse.redirect(`${origin}/register/pending`)
  }

  if (profile.status === 'rejected') {
    return NextResponse.redirect(`${origin}/login?error=rejected`)
  }

  if (profile.status === 'deactivated') {
    return NextResponse.redirect(`${origin}/login?error=deactivated`)
  }

  // active → Dashboard
  return NextResponse.redirect(`${origin}${next}`)
}
