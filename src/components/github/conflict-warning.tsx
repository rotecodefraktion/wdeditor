'use client'

import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import type { GitHubConflictInfo } from '@/lib/github-schema'

interface ConflictWarningProps {
  conflict: GitHubConflictInfo
  onOverride: () => void
  onCancel: () => void
  isOverriding?: boolean
}

export function ConflictWarning({
  conflict,
  onOverride,
  onCancel,
  isOverriding,
}: ConflictWarningProps) {
  const t = useTranslations('github')
  const tc = useTranslations('common')
  const { last_commit } = conflict
  const date = last_commit.date
    ? new Date(last_commit.date).toLocaleString('de-DE')
    : tc('unknown')

  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t('conflictTitle')}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          {t('conflictDescription', { author: last_commit.author || tc('unknown'), date })}
        </p>
        {last_commit.message && (
          <p className="text-xs text-muted-foreground font-mono truncate">
            {t('lastCommit', { message: last_commit.message })}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={onOverride}
            disabled={isOverriding}
          >
            {isOverriding ? t('overriding') : t('override')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isOverriding}
          >
            {tc('cancel')}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
