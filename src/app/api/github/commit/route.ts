import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getGitHubSettings,
  githubHeaders,
  encodeGitHubPath,
  GitHubError,
  checkGitHubRateLimitResponse,
  checkBranchExists,
} from '@/lib/github'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { commitRequestSchema } from '@/lib/github-schema'
import type { GitHubCommitResponse, GitHubConflictInfo } from '@/lib/github-schema'

/** Rate limit: 10 commits per 5 minutes per user */
const COMMIT_RATE_LIMIT = { maxRequests: 10, windowMs: 5 * 60_000 }

/**
 * POST /api/github/commit
 *
 * Commits updated file content to the configured dev-branch.
 * Includes SHA-based conflict detection.
 * Requires: authenticated + active user.
 */
export async function POST(request: NextRequest) {
  // CSRF protection: reject cross-origin requests
  const origin = request.headers.get('origin')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (origin && appUrl) {
    try {
      if (new URL(origin).origin !== new URL(appUrl).origin) {
        return NextResponse.json(
          { error: 'Cross-origin request rejected' },
          { status: 403 }
        )
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid origin header' },
        { status: 403 }
      )
    }
  }

  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check user is active + get profile data for commit attribution
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status, github_username, full_name')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    return NextResponse.json(
      { error: 'Account is not active' },
      { status: 403 }
    )
  }

  // Rate limit per user
  const rateLimitKey = `github-commit:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, COMMIT_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many commits. Please wait before trying again.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, COMMIT_RATE_LIMIT)

  // Parse & validate body
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    )
  }

  const parseResult = commitRequestSchema.safeParse(body)
  if (!parseResult.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parseResult.error.flatten() },
      { status: 400 }
    )
  }

  const { content, commit_message, file_type, current_sha, force } =
    parseResult.data

  // Fetch settings + decrypt PAT
  let settings
  try {
    settings = await getGitHubSettings()
  } catch (err) {
    if (err instanceof GitHubError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.httpStatus }
      )
    }
    return NextResponse.json(
      { error: 'Failed to load settings' },
      { status: 500 }
    )
  }

  // Verify dev branch exists before attempting any file operations
  const branchError = await checkBranchExists(settings)
  if (branchError) {
    return NextResponse.json(
      { error: branchError.message, code: branchError.code },
      { status: branchError.httpStatus }
    )
  }

  // Determine file path from settings
  const filePath =
    file_type === 'instance_profile'
      ? settings.instance_profile_path
      : settings.rules_txt_path

  const encodedPath = encodeGitHubPath(filePath)

  // Determine if this is a new file creation (no SHA provided)
  const isNewFile = !current_sha

  try {
    let shaForCommit: string | undefined

    if (!isNewFile) {
      // Conflict detection: fetch current file SHA from GitHub
      const checkRes = await fetch(
        `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.dev_branch)}`,
        {
          headers: githubHeaders(settings.pat),
          signal: AbortSignal.timeout(10_000),
        }
      )

      if (!checkRes.ok) {
        // Check for GitHub rate limiting before other error handling
        const rateLimitMsg = checkGitHubRateLimitResponse(checkRes)
        if (rateLimitMsg) {
          return NextResponse.json(
            { error: rateLimitMsg, code: 'RATE_LIMITED' },
            { status: 429 }
          )
        }
        if (checkRes.status === 404) {
          return NextResponse.json(
            {
              error: `File "${filePath}" no longer exists on branch "${settings.dev_branch}". It may have been deleted.`,
              code: 'FILE_DELETED',
            },
            { status: 409 }
          )
        }
        if (checkRes.status === 401) {
          return NextResponse.json(
            {
              error:
                'GitHub PAT is invalid or expired. Please ask an admin to update settings.',
              code: 'PAT_INVALID',
            },
            { status: 502 }
          )
        }
        return NextResponse.json(
          {
            error: `GitHub API error during conflict check: ${checkRes.status}`,
            code: 'GITHUB_ERROR',
          },
          { status: 502 }
        )
      }

      const currentFile = await checkRes.json()

      // SHA mismatch = someone else changed the file since it was loaded
      if (currentFile.sha !== current_sha && !force) {
        // Fetch latest commit info for conflict details
        const commitsRes = await fetch(
          `https://api.github.com/repos/${settings.owner}/${settings.repo}/commits?path=${encodedPath}&sha=${encodeURIComponent(settings.dev_branch)}&per_page=1`,
          {
            headers: githubHeaders(settings.pat),
            signal: AbortSignal.timeout(10_000),
          }
        )

        let lastCommit = {
          sha: '',
          author: '',
          email: '',
          date: '',
          message: '',
        }
        if (commitsRes.ok) {
          const commits = await commitsRes.json()
          if (commits.length > 0) {
            const c = commits[0]
            lastCommit = {
              sha: c.sha,
              author:
                c.commit.author?.name || c.author?.login || 'Unknown',
              email: c.commit.author?.email || '',
              date: c.commit.author?.date || '',
              message: c.commit.message,
            }
          }
        }

        const conflictInfo: GitHubConflictInfo = {
          conflict: true,
          current_sha: currentFile.sha,
          last_commit: lastCommit,
        }

        return NextResponse.json(conflictInfo, { status: 409 })
      }

      // Use the actual current SHA for the commit (handles force-override case)
      shaForCommit = currentFile.sha
    }

    // Build commit message with user attribution
    const userEmail = user.email || 'unknown@app.com'
    const githubUsername = profile.github_username || ''

    let fullMessage = commit_message
    if (force) {
      fullMessage += '\n\n[Override: Remote changes were overwritten]'
    }
    fullMessage += `\n\nChanged by: ${userEmail}${githubUsername ? ` (github: ${githubUsername})` : ''}`

    // Commit via GitHub Contents API PUT
    // For new files, omit sha; for updates, include it
    const commitBody: Record<string, unknown> = {
      message: fullMessage,
      content: Buffer.from(content).toString('base64'),
      branch: settings.dev_branch,
      author: {
        name: profile.full_name || 'WD Config Editor',
        email: userEmail,
      },
    }
    if (shaForCommit) {
      commitBody.sha = shaForCommit
    }

    const commitRes = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}`,
      {
        method: 'PUT',
        headers: {
          ...githubHeaders(settings.pat),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commitBody),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!commitRes.ok) {
      if (commitRes.status === 409) {
        return NextResponse.json(
          {
            error:
              'Conflict: The file was changed between conflict check and commit. Please reload and try again.',
            code: 'RACE_CONDITION',
          },
          { status: 409 }
        )
      }
      if (commitRes.status === 403) {
        const commitRateLimitMsg = checkGitHubRateLimitResponse(commitRes)
        if (commitRateLimitMsg) {
          return NextResponse.json(
            { error: commitRateLimitMsg, code: 'RATE_LIMITED' },
            { status: 429 }
          )
        }
        return NextResponse.json(
          {
            error:
              'Insufficient permissions. The PAT may not have push access to this branch.',
            code: 'PERMISSION_DENIED',
          },
          { status: 403 }
        )
      }
      if (commitRes.status === 422) {
        const errBody = await commitRes.json().catch(() => ({}))
        return NextResponse.json(
          {
            error: `GitHub rejected the commit: ${errBody.message || 'Unknown reason'}`,
            code: 'COMMIT_REJECTED',
          },
          { status: 422 }
        )
      }
      return NextResponse.json(
        {
          error: `GitHub API error: ${commitRes.status} ${commitRes.statusText}`,
          code: 'GITHUB_ERROR',
        },
        { status: 502 }
      )
    }

    const commitData = await commitRes.json()

    const response: GitHubCommitResponse = {
      commit_sha: commitData.commit.sha,
      commit_url: commitData.commit.html_url,
      file_sha: commitData.content.sha,
    }

    return NextResponse.json(response)
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      return NextResponse.json(
        {
          error: 'GitHub API request timed out. Please try again.',
          code: 'TIMEOUT',
        },
        { status: 504 }
      )
    }
    return NextResponse.json(
      {
        error: `Failed to reach GitHub API: ${err instanceof Error ? err.message : 'Unknown error'}`,
        code: 'NETWORK_ERROR',
      },
      { status: 502 }
    )
  }
}
