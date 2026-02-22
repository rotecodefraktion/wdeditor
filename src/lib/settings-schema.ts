import { z } from 'zod'

/**
 * Shared Zod schema for Global Settings (PROJ-4).
 * Used by both frontend form validation and API route validation.
 */

const repoPattern = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/

export const settingsFormSchema = z.object({
  github_repo: z
    .string()
    .min(1, 'Repository is required.')
    .transform((val) => {
      // Strip full GitHub URL down to owner/repo
      const match = val.match(
        /(?:https?:\/\/github\.com\/)?([a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+)\/?$/
      )
      return match ? match[1] : val
    })
    .refine((val) => repoPattern.test(val), {
      message: 'Format must be owner/repo (e.g. acme/web-dispatcher-config).',
    }),
  github_pat: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.startsWith('ghp_') || val.startsWith('github_pat_'),
      {
        message:
          'GitHub PAT must start with ghp_ or github_pat_.',
      }
    ),
  dev_branch: z
    .string()
    .min(1, 'Branch name is required.')
    .max(255, 'Branch name is too long.')
    .regex(
      /^[a-zA-Z0-9._\/-]+$/,
      'Branch name contains invalid characters.'
    ),
  instance_profile_path: z
    .string()
    .min(1, 'Instance profile path is required.')
    .max(500, 'Path is too long.')
    .regex(
      /^[a-zA-Z0-9._\/-]+$/,
      'Path contains invalid characters.'
    )
    .refine((val) => !/(^|\/)\.\.($|\/)/.test(val), {
      message: 'Path traversal (..) is not allowed.',
    }),
  rules_txt_path: z
    .string()
    .min(1, 'Rules.txt path is required.')
    .max(500, 'Path is too long.')
    .regex(
      /^[a-zA-Z0-9._\/-]+$/,
      'Path contains invalid characters.'
    )
    .refine((val) => !/(^|\/)\.\.($|\/)/.test(val), {
      message: 'Path traversal (..) is not allowed.',
    }),
})

export type SettingsFormValues = z.infer<typeof settingsFormSchema>

/** Shape returned by GET /api/settings (never includes full PAT) */
export interface SettingsResponse {
  github_repo: string
  github_pat_hint: string | null
  dev_branch: string
  instance_profile_path: string
  rules_txt_path: string
  updated_at: string | null
  updated_by: string | null
  has_pat: boolean
}

/** Shape of each check from POST /api/settings/test-connection */
export type CheckStatus = 'pass' | 'warn' | 'fail'

export interface ConnectionCheckResult {
  name: string
  label: string
  status: CheckStatus
  message: string
}

export interface ConnectionTestResponse {
  results: ConnectionCheckResult[]
}
