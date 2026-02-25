/**
 * Zod schemas and TypeScript types for PROJ-7 GitHub API routes.
 */

import { z } from 'zod'

/** Allowed file types for read/commit operations */
export const fileTypeSchema = z.enum(['instance_profile', 'rules'])
export type FileType = z.infer<typeof fileTypeSchema>

/** POST /api/github/commit request body validation */
export const commitRequestSchema = z.object({
  content: z
    .string()
    .min(1, 'File content is required.')
    .max(5_000_000, 'File content exceeds 5 MB limit.'),
  commit_message: z
    .string()
    .min(1, 'Commit message is required.')
    .max(200, 'Commit message is too long.'),
  file_type: fileTypeSchema,
  current_sha: z.string().optional().default(''),
  force: z.boolean().optional().default(false),
})
export type CommitRequest = z.infer<typeof commitRequestSchema>

/** Response from GET /api/github/file */
export interface GitHubFileResponse {
  content: string
  sha: string
  last_commit: {
    sha: string
    message: string
    author: string
    email: string
    date: string
  }
  file_path: string
}

/** Response from POST /api/github/commit on success */
export interface GitHubCommitResponse {
  commit_sha: string
  commit_url: string
  file_sha: string
}

/** Response from GET /api/github/check-access */
export interface GitHubAccessCheckResponse {
  has_access: boolean | null
  reason?: 'NOT_COLLABORATOR' | 'NO_GITHUB_USERNAME' | 'CHECK_UNAVAILABLE' | 'SETTINGS_NOT_CONFIGURED'
  username?: string
}

/** Response from POST /api/github/commit on conflict (HTTP 409) */
export interface GitHubConflictInfo {
  conflict: true
  current_sha: string
  last_commit: {
    sha: string
    author: string
    email: string
    date: string
    message: string
  }
}
