'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ActiveLockWarningProps {
  lockCount: number
}

export function ActiveLockWarning({ lockCount }: ActiveLockWarningProps) {
  const t = useTranslations('settings')
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || lockCount === 0) return null

  return (
    <Alert className="border-yellow-500/50 bg-yellow-50 dark:bg-yellow-950/30">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
      <AlertTitle className="text-yellow-800 dark:text-yellow-200">
        {t('activeLockTitle')}
      </AlertTitle>
      <AlertDescription className="text-yellow-700 dark:text-yellow-300">
        {lockCount === 1
          ? t('activeLockSingle')
          : t('activeLockMultiple', { count: lockCount })}{' '}
        {t('activeLockHint')}
      </AlertDescription>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-2 top-2 h-6 w-6 text-yellow-600 hover:text-yellow-800 dark:text-yellow-400 dark:hover:text-yellow-200"
        onClick={() => setDismissed(true)}
        aria-label={t('dismissWarning')}
      >
        <X className="h-4 w-4" />
      </Button>
    </Alert>
  )
}
