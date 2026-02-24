import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGitHubSettings, githubHeaders, GitHubError } from '@/lib/github'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import type { GitHubAccessCheckResponse } from '@/lib/github-schema'

/** Rate limit: 10 access checks per minute per user */
const ACCESS_CHECK_RATE_LIMIT = { maxRequests: 10, windowMs: 60_000 }

/**
 * GET /api/github/check-access
 *
 * Checks whether the authenticated user's GitHub username has collaborator
 * access to the configured repository. Non-blocking — a failed check does
 * not prevent app usage.
 *
 * Uses the shared PAT to call GET /repos/{owner}/{repo}/collaborators/{username}.
 * This requires the PAT to have admin or push access on the repo.
 * If the PAT lacks those permissions, returns has_access: null (graceful degradation).
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

  // Get user's GitHub username and status
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, github_username')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    return NextResponse.json(
      { error: 'Account is not active' },
      { status: 403 }
    )
  }

  // Rate limit per user
  const rateLimitKey = `github-check-access:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, ACCESS_CHECK_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, ACCESS_CHECK_RATE_LIMIT)

  // No GitHub username configured for this user
  if (!profile.github_username) {
    const response: GitHubAccessCheckResponse = {
      has_access: false,
      reason: 'NO_GITHUB_USERNAME',
    }
    return NextResponse.json(response)
  }

  // Fetch settings + decrypt PAT
  let settings
  try {
    settings = await getGitHubSettings()
  } catch (err) {
    if (err instanceof GitHubError) {
      const response: GitHubAccessCheckResponse = {
        has_access: null,
        reason: 'SETTINGS_NOT_CONFIGURED',
        username: profile.github_username,
      }
      return NextResponse.json(response)
    }
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }

  // Check collaborator access via GitHub API
  try {
    const res = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/collaborators/${encodeURIComponent(profile.github_username)}`,
      {
        headers: githubHeaders(settings.pat),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (res.status === 204) {
      // 204 No Content = user is a collaborator
      const response: GitHubAccessCheckResponse = {
        has_access: true,
        username: profile.github_username,
      }
      return NextResponse.json(response)
    }

    if (res.status === 404) {
      // 404 = user is not a collaborator
      const response: GitHubAccessCheckResponse = {
        has_access: false,
        reason: 'NOT_COLLABORATOR',
        username: profile.github_username,
      }
      return NextResponse.json(response)
    }

    if (res.status === 403) {
      // 403 = PAT doesn't have admin/push rights to check collaborators
      // Graceful degradation: can't determine access, don't block the user
      const response: GitHubAccessCheckResponse = {
        has_access: null,
        reason: 'CHECK_UNAVAILABLE',
        username: profile.github_username,
      }
      return NextResponse.json(response)
    }

    // Other errors: graceful degradation
    const response: GitHubAccessCheckResponse = {
      has_access: null,
      reason: 'CHECK_UNAVAILABLE',
      username: profile.github_username,
    }
    return NextResponse.json(response)
  } catch {
    // Network/timeout: graceful degradation
    const response: GitHubAccessCheckResponse = {
      has_access: null,
      reason: 'CHECK_UNAVAILABLE',
      username: profile.github_username,
    }
    return NextResponse.json(response)
  }
}
