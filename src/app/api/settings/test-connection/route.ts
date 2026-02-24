import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/encryption'
import { githubHeaders, encodeGitHubPath } from '@/lib/github'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import type { ConnectionCheckResult, ConnectionTestResponse } from '@/lib/settings-schema'

/** Rate limit: max 5 test-connection requests per minute per user */
const TEST_CONNECTION_RATE_LIMIT = { maxRequests: 5, windowMs: 60_000 }

/**
 * POST /api/settings/test-connection
 * Tests the GitHub connection using the stored (encrypted) PAT.
 * PAT never leaves the server -- decrypted only for API calls.
 * Requires admin or super_admin role.
 */
export async function POST() {
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
  const rateLimitKey = `test-connection:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, TEST_CONNECTION_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before testing again.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, TEST_CONNECTION_RATE_LIMIT)

  // Role check
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || !['admin', 'super_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch settings from DB
  const { data: settings, error: settingsError } = await supabase
    .from('app_settings')
    .select('github_repo, github_pat_encrypted, dev_branch, instance_profile_path, rules_txt_path')
    .limit(1)
    .single()

  if (settingsError || !settings) {
    return NextResponse.json(
      { error: 'Settings not configured yet. Please save settings first.' },
      { status: 400 }
    )
  }

  if (!settings.github_pat_encrypted) {
    return NextResponse.json(
      { error: 'No GitHub PAT configured. Please save a PAT first.' },
      { status: 400 }
    )
  }

  // Decrypt PAT server-side
  let pat: string
  try {
    pat = decrypt(settings.github_pat_encrypted)
  } catch {
    return NextResponse.json(
      { error: 'Failed to decrypt PAT. The encryption key may have changed.' },
      { status: 500 }
    )
  }

  const results: ConnectionCheckResult[] = []
  const owner = settings.github_repo?.split('/')[0]
  const repo = settings.github_repo?.split('/')[1]

  if (!owner || !repo) {
    return NextResponse.json(
      { error: 'Invalid repository format. Expected owner/repo.' },
      { status: 400 }
    )
  }

  // Check 1: Repository accessible + Check 2: PAT permissions
  // Both use the same GET /repos/{owner}/{repo} response, so we reuse it.
  let repoAccessible = false
  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: githubHeaders(pat),
      signal: AbortSignal.timeout(10_000),
    })

    if (repoRes.ok) {
      repoAccessible = true
      results.push({
        name: 'repo_access',
        label: 'Repository accessible',
        status: 'pass',
        message: `Repository ${owner}/${repo} is accessible.`,
      })

      // Check 2: PAT permissions from the same response
      const repoData = await repoRes.json()
      const permissions = repoData.permissions || {}

      if (permissions.push || permissions.admin) {
        results.push({
          name: 'pat_permissions',
          label: 'PAT permissions (contents read/write)',
          status: 'pass',
          message: 'PAT has sufficient permissions for read and write operations.',
        })
      } else if (permissions.pull) {
        results.push({
          name: 'pat_permissions',
          label: 'PAT permissions (contents read/write)',
          status: 'warn',
          message:
            'PAT has read access only. Write operations (commits) will fail. Ensure the PAT has the "repo" scope or "contents: write" permission.',
        })
      } else {
        results.push({
          name: 'pat_permissions',
          label: 'PAT permissions (contents read/write)',
          status: 'fail',
          message:
            'Cannot determine PAT permissions. Ensure the PAT has the "repo" scope or "contents: read" and "contents: write" permissions.',
        })
      }
    } else if (repoRes.status === 404) {
      results.push({
        name: 'repo_access',
        label: 'Repository accessible',
        status: 'fail',
        message: `Repository ${owner}/${repo} not found or no access. Check the repository URL and PAT permissions.`,
      })
      // Can't continue with other checks if repo isn't accessible
      const response: ConnectionTestResponse = { results }
      return NextResponse.json(response)
    } else if (repoRes.status === 401) {
      results.push({
        name: 'repo_access',
        label: 'Repository accessible',
        status: 'fail',
        message: 'PAT is invalid or expired. Please update the token in settings.',
      })
      const response: ConnectionTestResponse = { results }
      return NextResponse.json(response)
    } else {
      results.push({
        name: 'repo_access',
        label: 'Repository accessible',
        status: 'fail',
        message: `GitHub API error: ${repoRes.status} ${repoRes.statusText}`,
      })
      const response: ConnectionTestResponse = { results }
      return NextResponse.json(response)
    }
  } catch (err) {
    results.push({
      name: 'repo_access',
      label: 'Repository accessible',
      status: 'fail',
      message: `Failed to reach GitHub API: ${err instanceof Error ? err.message : 'Unknown error'}`,
    })
    const response: ConnectionTestResponse = { results }
    return NextResponse.json(response)
  }

  // Only proceed with remaining checks if repo is accessible
  if (!repoAccessible) {
    const response: ConnectionTestResponse = { results }
    return NextResponse.json(response)
  }

  // Check 3: Dev branch exists
  try {
    const branchRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(settings.dev_branch)}`,
      { headers: githubHeaders(pat), signal: AbortSignal.timeout(10_000) }
    )

    if (branchRes.ok) {
      results.push({
        name: 'dev_branch',
        label: 'Dev branch exists',
        status: 'pass',
        message: `Branch "${settings.dev_branch}" exists.`,
      })
    } else if (branchRes.status === 404) {
      results.push({
        name: 'dev_branch',
        label: 'Dev branch exists',
        status: 'warn',
        message: `Branch "${settings.dev_branch}" does not exist. Commits will fail until this branch is created.`,
      })
    } else {
      results.push({
        name: 'dev_branch',
        label: 'Dev branch exists',
        status: 'fail',
        message: `Failed to check branch: ${branchRes.status} ${branchRes.statusText}`,
      })
    }
  } catch {
    results.push({
      name: 'dev_branch',
      label: 'Dev branch exists',
      status: 'fail',
      message: 'Failed to check dev branch.',
    })
  }

  // Check 4: Instance profile path exists
  if (settings.instance_profile_path) {
    try {
      const encodedPath = encodeGitHubPath(settings.instance_profile_path)
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.dev_branch)}`,
        { headers: githubHeaders(pat), signal: AbortSignal.timeout(10_000) }
      )

      if (fileRes.ok) {
        results.push({
          name: 'instance_profile_path',
          label: 'Instance profile path exists',
          status: 'pass',
          message: `File "${settings.instance_profile_path}" found in repository.`,
        })
      } else if (fileRes.status === 404) {
        results.push({
          name: 'instance_profile_path',
          label: 'Instance profile path exists',
          status: 'warn',
          message: `File "${settings.instance_profile_path}" not found in branch "${settings.dev_branch}". It may be created later.`,
        })
      } else {
        results.push({
          name: 'instance_profile_path',
          label: 'Instance profile path exists',
          status: 'fail',
          message: `Failed to check file: ${fileRes.status} ${fileRes.statusText}`,
        })
      }
    } catch {
      results.push({
        name: 'instance_profile_path',
        label: 'Instance profile path exists',
        status: 'fail',
        message: 'Failed to check instance profile path.',
      })
    }
  }

  // Check 5: Rules.txt path exists
  if (settings.rules_txt_path) {
    try {
      const encodedPath = encodeGitHubPath(settings.rules_txt_path)
      const fileRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.dev_branch)}`,
        { headers: githubHeaders(pat), signal: AbortSignal.timeout(10_000) }
      )

      if (fileRes.ok) {
        results.push({
          name: 'rules_txt_path',
          label: 'Rules.txt path exists',
          status: 'pass',
          message: `File "${settings.rules_txt_path}" found in repository.`,
        })
      } else if (fileRes.status === 404) {
        results.push({
          name: 'rules_txt_path',
          label: 'Rules.txt path exists',
          status: 'warn',
          message: `File "${settings.rules_txt_path}" not found in branch "${settings.dev_branch}". It may be created later.`,
        })
      } else {
        results.push({
          name: 'rules_txt_path',
          label: 'Rules.txt path exists',
          status: 'fail',
          message: `Failed to check file: ${fileRes.status} ${fileRes.statusText}`,
        })
      }
    } catch {
      results.push({
        name: 'rules_txt_path',
        label: 'Rules.txt path exists',
        status: 'fail',
        message: 'Failed to check rules.txt path.',
      })
    }
  }

  const response: ConnectionTestResponse = { results }
  return NextResponse.json(response)
}
