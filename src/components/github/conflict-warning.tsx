'use client'

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
  const { last_commit } = conflict
  const date = last_commit.date
    ? new Date(last_commit.date).toLocaleString('de-DE')
    : 'Unknown'

  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Konflikt erkannt</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Die Datei wurde seit deinem Laden von{' '}
          <strong>{last_commit.author || 'Unknown'}</strong> ({date}) geändert.
        </p>
        {last_commit.message && (
          <p className="text-xs text-muted-foreground font-mono truncate">
            Letzter Commit: {last_commit.message}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            variant="destructive"
            size="sm"
            onClick={onOverride}
            disabled={isOverriding}
          >
            {isOverriding ? 'Überschreibe...' : 'Überschreiben'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isOverriding}
          >
            Abbrechen
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
