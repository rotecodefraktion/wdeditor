'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { GitHubAccessCheckResponse } from '@/lib/github-schema'

interface GitHubAccessWarningProps {
  userRole?: string
}

/**
 * Non-blocking warning shown on the Dashboard when the user's GitHub account
 * does not have collaborator access to the configured repository.
 *
 * - Admins see nothing (they can fix it themselves via Settings).
 * - If the check is unavailable (PAT lacks admin rights), silently skips.
 * - If settings are not configured, silently skips (UnconfiguredBanner handles that).
 */
export function GitHubAccessWarning({ userRole }: GitHubAccessWarningProps) {
  const t = useTranslations('github')
  const [data, setData] = useState<GitHubAccessCheckResponse | null>(null)

  const isAdmin = userRole === 'admin' || userRole === 'super_admin'

  useEffect(() => {
    if (isAdmin) return

    async function checkAccess() {
      try {
        const res = await fetch('/api/github/check-access')
        if (res.ok) {
          setData(await res.json())
        }
      } catch {
        // Silently fail — warning just won't show
      }
    }
    checkAccess()
  }, [isAdmin])

  // Don't show for admins, or when data isn't loaded yet
  if (isAdmin || !data) return null

  // Only show when has_access is explicitly false
  if (data.has_access !== false) return null

  // Don't show if settings aren't configured (UnconfiguredBanner covers that)
  if (data.reason === 'SETTINGS_NOT_CONFIGURED') return null

  const message =
    data.reason === 'NO_GITHUB_USERNAME'
      ? t('noGithubUsername')
      : t('noRepoAccessDescription', { username: data.username ?? '' })

  return (
    <Alert className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/30">
      <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
      <AlertTitle className="text-orange-800 dark:text-orange-200">
        {t('noRepoAccess')}
      </AlertTitle>
      <AlertDescription className="text-orange-700 dark:text-orange-300">
        {message}
      </AlertDescription>
    </Alert>
  )
}
