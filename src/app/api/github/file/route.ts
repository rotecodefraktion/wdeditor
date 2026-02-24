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
import { fileTypeSchema } from '@/lib/github-schema'
import type { GitHubFileResponse } from '@/lib/github-schema'

/** Rate limit: 30 file reads per minute per user */
const FILE_READ_RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 }

/**
 * GET /api/github/file?type=instance_profile|rules
 *
 * Reads a file from GitHub via the Contents API.
 * Returns: decoded content, SHA, last commit metadata.
 * Requires: authenticated + active user.
 * PAT is decrypted server-side only.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Check user is active
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('status')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.status !== 'active') {
    return NextResponse.json(
      { error: 'Account is not active' },
      { status: 403 }
    )
  }

  // Rate limit per user
  const rateLimitKey = `github-file:${user.id}`
  const rateCheck = checkRateLimit(rateLimitKey, FILE_READ_RATE_LIMIT)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before retrying.' },
      { status: 429 }
    )
  }
  incrementRateLimit(rateLimitKey, FILE_READ_RATE_LIMIT)

  // Validate query param
  const type = request.nextUrl.searchParams.get('type')
  const typeResult = fileTypeSchema.safeParse(type)
  if (!typeResult.success) {
    return NextResponse.json(
      {
        error:
          'Invalid file type. Must be "instance_profile" or "rules".',
        code: 'INVALID_FILE_TYPE',
      },
      { status: 400 }
    )
  }

  // Fetch settings + decrypt PAT (admin client, server-side only)
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

  // Verify dev branch exists before attempting file read
  const branchError = await checkBranchExists(settings)
  if (branchError) {
    return NextResponse.json(
      { error: branchError.message, code: branchError.code },
      { status: branchError.httpStatus }
    )
  }

  // Determine file path from settings based on type
  const filePath =
    typeResult.data === 'instance_profile'
      ? settings.instance_profile_path
      : settings.rules_txt_path

  const encodedPath = encodeGitHubPath(filePath)

  try {
    // Fetch file content from GitHub Contents API
    const fileRes = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/contents/${encodedPath}?ref=${encodeURIComponent(settings.dev_branch)}`,
      {
        headers: githubHeaders(settings.pat),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (!fileRes.ok) {
      // Check for GitHub rate limiting before other error handling
      const rateLimitMsg = checkGitHubRateLimitResponse(fileRes)
      if (rateLimitMsg) {
        return NextResponse.json(
          { error: rateLimitMsg, code: 'RATE_LIMITED' },
          { status: 429 }
        )
      }
      if (fileRes.status === 404) {
        return NextResponse.json(
          {
            error: `File "${filePath}" not found in branch "${settings.dev_branch}".`,
            code: 'FILE_NOT_FOUND',
          },
          { status: 404 }
        )
      }
      if (fileRes.status === 401) {
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
          error: `GitHub API error: ${fileRes.status} ${fileRes.statusText}`,
          code: 'GITHUB_ERROR',
        },
        { status: 502 }
      )
    }

    const fileData = await fileRes.json()

    // Decode Base64 content
    const content = Buffer.from(fileData.content, 'base64').toString('utf-8')

    // Fetch the last commit for this specific file
    const commitsRes = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/commits?path=${encodedPath}&sha=${encodeURIComponent(settings.dev_branch)}&per_page=1`,
      {
        headers: githubHeaders(settings.pat),
        signal: AbortSignal.timeout(10_000),
      }
    )

    let lastCommit = { sha: '', message: '', author: '', email: '', date: '' }
    if (commitsRes.ok) {
      const commits = await commitsRes.json()
      if (commits.length > 0) {
        const c = commits[0]
        lastCommit = {
          sha: c.sha,
          message: c.commit.message,
          author:
            c.commit.author?.name || c.author?.login || 'Unknown',
          email: c.commit.author?.email || '',
          date: c.commit.author?.date || '',
        }
      }
    }

    const response: GitHubFileResponse = {
      content,
      sha: fileData.sha,
      last_commit: lastCommit,
      file_path: filePath,
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
