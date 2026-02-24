/**
 * Shared GitHub service helpers for PROJ-7.
 * Used by /api/github/file and /api/github/commit routes.
 * PAT is decrypted server-side only — never leaves the server.
 */

import { decrypt } from '@/lib/encryption'
import { createAdminClient } from '@/lib/supabase/admin'

/** Standard GitHub API v3 request headers */
export function githubHeaders(pat: string) {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

/**
 * Encode a file path for the GitHub Contents API.
 * Each path segment is individually URI-encoded so that `/` separators
 * are preserved while special characters within segments are escaped.
 */
export function encodeGitHubPath(filePath: string): string {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
}

/** Branches that are never allowed as commit targets */
const PROTECTED_BRANCHES = ['main', 'master']

/** Resolved GitHub settings with decrypted PAT */
export interface GitHubSettings {
  owner: string
  repo: string
  pat: string
  dev_branch: string
  instance_profile_path: string
  rules_txt_path: string
}

/** Custom error class for structured GitHub error handling */
export class GitHubError extends Error {
  code: string
  httpStatus: number

  constructor(message: string, code: string, httpStatus: number = 400) {
    super(message)
    this.name = 'GitHubError'
    this.code = code
    this.httpStatus = httpStatus
  }
}

/**
 * Fetch app_settings via admin client (bypasses RLS) and decrypt the PAT.
 * Throws GitHubError with structured codes on failure.
 */
export async function getGitHubSettings(): Promise<GitHubSettings> {
  const adminClient = createAdminClient()

  const { data: settings, error } = await adminClient
    .from('app_settings')
    .select(
      'github_repo, github_pat_encrypted, dev_branch, instance_profile_path, rules_txt_path'
    )
    .limit(1)
    .single()

  if (error || !settings) {
    throw new GitHubError(
      'Settings not configured. Please ask an admin to configure GitHub settings.',
      'SETTINGS_NOT_CONFIGURED'
    )
  }

  if (!settings.github_pat_encrypted) {
    throw new GitHubError(
      'No GitHub PAT configured. Please ask an admin to save a PAT.',
      'PAT_NOT_CONFIGURED'
    )
  }

  const [owner, repo] = (settings.github_repo || '').split('/')
  if (!owner || !repo) {
    throw new GitHubError(
      'Invalid repository format in settings. Expected owner/repo.',
      'INVALID_REPO_FORMAT'
    )
  }

  // Validate dev_branch is not a protected branch
  if (PROTECTED_BRANCHES.includes(settings.dev_branch.toLowerCase())) {
    throw new GitHubError(
      `Commits to "${settings.dev_branch}" are not allowed. Please configure a different dev branch.`,
      'PROTECTED_BRANCH',
      403
    )
  }

  let pat: string
  try {
    pat = decrypt(settings.github_pat_encrypted)
  } catch {
    throw new GitHubError(
      'Failed to decrypt PAT. The encryption key may have changed.',
      'PAT_DECRYPT_FAILED',
      500
    )
  }

  return {
    owner,
    repo,
    pat,
    dev_branch: settings.dev_branch,
    instance_profile_path: settings.instance_profile_path,
    rules_txt_path: settings.rules_txt_path,
  }
}

/**
 * Check if a GitHub API response is a rate limit error (403 with X-RateLimit-Remaining: 0).
 * Returns a user-friendly error message with wait time, or null if not rate-limited.
 */
export function checkGitHubRateLimitResponse(res: Response): string | null {
  if (res.status !== 403) return null

  const remaining = res.headers.get('X-RateLimit-Remaining')
  if (remaining !== '0') return null

  const resetTimestamp = res.headers.get('X-RateLimit-Reset')
  if (resetTimestamp) {
    const resetDate = new Date(parseInt(resetTimestamp, 10) * 1000)
    const waitMs = resetDate.getTime() - Date.now()
    const waitMinutes = Math.max(1, Math.ceil(waitMs / 60_000))
    return `GitHub API Rate Limit erreicht. Bitte ${waitMinutes} Minute${waitMinutes > 1 ? 'n' : ''} warten.`
  }

  return 'GitHub API Rate Limit erreicht. Bitte einige Minuten warten.'
}

/**
 * Verify the configured dev branch exists on GitHub.
 * Returns null if the branch exists, or a GitHubError if not.
 */
export async function checkBranchExists(
  settings: GitHubSettings
): Promise<GitHubError | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${settings.owner}/${settings.repo}/branches/${encodeURIComponent(settings.dev_branch)}`,
      {
        headers: githubHeaders(settings.pat),
        signal: AbortSignal.timeout(10_000),
      }
    )

    if (res.status === 404) {
      return new GitHubError(
        `Branch "${settings.dev_branch}" existiert nicht. Bitte Settings aktualisieren.`,
        'BRANCH_NOT_FOUND',
        400
      )
    }

    // Rate limit check on branch request
    const rateLimitMsg = checkGitHubRateLimitResponse(res)
    if (rateLimitMsg) {
      return new GitHubError(rateLimitMsg, 'RATE_LIMITED', 429)
    }

    // Other errors: don't block, proceed gracefully
    return null
  } catch {
    // Network/timeout: don't block the operation
    return null
  }
}
